import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'enterprises.db')

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_conn()
    # 企业档案表
    conn.execute('''CREATE TABLE IF NOT EXISTS enterprises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        credit_code TEXT UNIQUE NOT NULL,
        enterprise_type TEXT NOT NULL DEFAULT 'factory',
        district TEXT DEFAULT '',
        industry TEXT DEFAULT '',
        contact_person TEXT DEFAULT '',
        contact_phone TEXT DEFAULT '',
        employee_count INTEGER DEFAULT 0,
        risk_score INTEGER DEFAULT -1,
        risk_level TEXT DEFAULT '未评估',
        is_red_line INTEGER DEFAULT 0,
        risk_details TEXT DEFAULT '[]',
        recommended_actions TEXT DEFAULT '',
        last_assessed_at TEXT DEFAULT '',
        raw_data TEXT DEFAULT '{}',
        created_at TEXT DEFAULT ''
    )''')
    # 指标快照表（每次推送指标数据时写入，保留历史）
    conn.execute('''CREATE TABLE IF NOT EXISTS indicator_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credit_code TEXT NOT NULL,
        enterprise_type TEXT NOT NULL DEFAULT 'factory',
        indicator_data TEXT NOT NULL DEFAULT '{}',
        data_source TEXT DEFAULT '手动录入',
        snapshot_at TEXT DEFAULT ''
    )''')
    # 评估历史表（每次评估后写入，保留完整历史轨迹）
    conn.execute('''CREATE TABLE IF NOT EXISTS assessment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credit_code TEXT NOT NULL,
        enterprise_id INTEGER,
        enterprise_name TEXT DEFAULT '',
        enterprise_type TEXT NOT NULL DEFAULT 'factory',
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        is_red_line INTEGER DEFAULT 0,
        risk_details TEXT DEFAULT '[]',
        recommended_actions TEXT DEFAULT '',
        indicator_data TEXT DEFAULT '{}',
        assessed_at TEXT DEFAULT ''
    )''')
    conn.commit()
    conn.close()

def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    d['is_red_line'] = bool(d.get('is_red_line', 0))
    for json_field in ['risk_details', 'raw_data', 'indicator_data']:
        if json_field in d:
            try:
                d[json_field] = json.loads(d[json_field])
            except:
                d[json_field] = [] if json_field == 'risk_details' else {}
    return d

# ==================== 企业档案 CRUD ====================

def list_enterprises(risk_level=None, enterprise_type=None, search=None, page=1, page_size=50):
    conn = get_conn()
    conditions, params = [], []
    if risk_level:
        conditions.append("risk_level = ?"); params.append(risk_level)
    if enterprise_type:
        conditions.append("enterprise_type = ?"); params.append(enterprise_type)
    if search:
        conditions.append("(name LIKE ? OR credit_code LIKE ?)"); params.extend([f'%{search}%', f'%{search}%'])
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    total = conn.execute(f"SELECT COUNT(*) as cnt FROM enterprises{where}", params).fetchone()['cnt']
    offset = (page - 1) * page_size
    rows = conn.execute(
        f"SELECT * FROM enterprises{where} ORDER BY risk_score DESC, id DESC LIMIT ? OFFSET ?",
        params + [page_size, offset]
    ).fetchall()
    conn.close()
    return {"total": total, "page": page, "page_size": page_size, "items": [row_to_dict(r) for r in rows]}

def get_enterprise(eid):
    conn = get_conn()
    row = conn.execute("SELECT * FROM enterprises WHERE id = ?", (eid,)).fetchone()
    conn.close()
    return row_to_dict(row)

def get_enterprise_by_credit_code(credit_code):
    conn = get_conn()
    row = conn.execute("SELECT * FROM enterprises WHERE credit_code = ?", (credit_code,)).fetchone()
    conn.close()
    return row_to_dict(row)

def create_enterprise(data: dict):
    conn = get_conn()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        "INSERT INTO enterprises (name,credit_code,enterprise_type,district,industry,contact_person,contact_phone,employee_count,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (data.get('name',''), data.get('credit_code',''), data.get('enterprise_type','factory'),
         data.get('district',''), data.get('industry',''), data.get('contact_person',''),
         data.get('contact_phone',''), data.get('employee_count',0), now)
    )
    conn.commit()
    eid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return eid

def update_enterprise(eid, data: dict):
    conn = get_conn()
    fields, params = [], []
    for k in ['name','credit_code','enterprise_type','district','industry','contact_person','contact_phone','employee_count']:
        if k in data:
            fields.append(f"{k} = ?"); params.append(data[k])
    if not fields:
        conn.close(); return False
    params.append(eid)
    conn.execute(f"UPDATE enterprises SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit(); conn.close()
    return True

def delete_enterprise(eid):
    conn = get_conn()
    conn.execute("DELETE FROM enterprises WHERE id = ?", (eid,))
    conn.commit(); conn.close()

def save_assessment(eid, score, level, is_red_line, details, actions, raw_data):
    """写回企业库最新评估结果，同时追加评估历史"""
    conn = get_conn()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    details_json = json.dumps(details, ensure_ascii=False)
    raw_json = json.dumps(raw_data, ensure_ascii=False)
    # 更新企业最新评估结果
    conn.execute(
        "UPDATE enterprises SET risk_score=?,risk_level=?,is_red_line=?,risk_details=?,recommended_actions=?,last_assessed_at=?,raw_data=? WHERE id=?",
        (score, level, int(is_red_line), details_json, actions, now, raw_json, eid)
    )
    # 查询企业信息用于历史记录
    ent = conn.execute("SELECT credit_code, name, enterprise_type FROM enterprises WHERE id=?", (eid,)).fetchone()
    if ent:
        conn.execute(
            "INSERT INTO assessment_history (credit_code,enterprise_id,enterprise_name,enterprise_type,risk_score,risk_level,is_red_line,risk_details,recommended_actions,indicator_data,assessed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (ent['credit_code'], eid, ent['name'], ent['enterprise_type'], score, level, int(is_red_line), details_json, actions, raw_json, now)
        )
    conn.commit(); conn.close()

# ==================== 指标快照 ====================

def push_indicator_snapshot(credit_code: str, enterprise_type: str, indicator_data: dict, data_source: str = '外部系统推送'):
    """推送指标快照，按统一信用代码关联企业"""
    conn = get_conn()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        "INSERT INTO indicator_snapshots (credit_code,enterprise_type,indicator_data,data_source,snapshot_at) VALUES (?,?,?,?,?)",
        (credit_code, enterprise_type, json.dumps(indicator_data, ensure_ascii=False), data_source, now)
    )
    conn.commit(); conn.close()

def get_latest_snapshot(credit_code: str):
    """获取某企业最新的指标快照"""
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM indicator_snapshots WHERE credit_code=? ORDER BY snapshot_at DESC LIMIT 1",
        (credit_code,)
    ).fetchone()
    conn.close()
    return row_to_dict(row)

def list_snapshots(credit_code: str, limit: int = 10):
    """获取某企业最近N次的指标快照历史"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM indicator_snapshots WHERE credit_code=? ORDER BY snapshot_at DESC LIMIT ?",
        (credit_code, limit)
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]

# ==================== 评估历史 ====================

def get_assessment_history(credit_code: str, limit: int = 20):
    """获取某企业的评估历史记录"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM assessment_history WHERE credit_code=? ORDER BY assessed_at DESC LIMIT ?",
        (credit_code, limit)
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]

# ==================== 指标总览 ====================

def get_all_indicators():
    """获取所有指标及统计概览"""
    import json
    conn = get_conn()

    # 统计各维度下的触发企业数
    # 从assessment_history中获取最近一次评估的风险详情，汇总各指标触发次数
    indicators = {}

    # 获取所有企业
    enterprises = conn.execute("SELECT id, credit_code, enterprise_type, name FROM enterprises").fetchall()

    rule_config = {}
    try:
        with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rules_config.json'), 'r', encoding='utf-8') as f:
            rule_config = json.load(f)
    except:
        pass

    for domain_name, domain_cfg in rule_config.items():
        if domain_name == 'system': continue
        rules = domain_cfg.get('rules', [])
        for rule in rules:
            key = rule.get('key', '')
            if key not in indicators:
                indicators[key] = {
                    'key': key,
                    'name': rule.get('name', ''),
                    'category': rule.get('category', ''),
                    'domain': domain_name,
                    'score': rule.get('score', 0),
                    'is_red_line': rule.get('is_red_line', False),
                    'operator': rule.get('operator', ''),
                    'threshold': str(rule.get('threshold', '')),
                    'source': rule.get('source', ''),
                    'triggered_count': 0,
                    'triggered_enterprises': []
                }

    # 遍历企业最新评估详情，统计指标触发情况
    for ent in enterprises:
        history = conn.execute(
            "SELECT risk_details FROM assessment_history WHERE credit_code=? ORDER BY assessed_at DESC LIMIT 1",
            (ent['credit_code'],)
        ).fetchone()
        if history:
            try:
                details = json.loads(history['risk_details'])
                for d in details:
                    item_name = d.get('item_name', '')
                    for key, ind in indicators.items():
                        if ind['name'] == item_name:
                            ind['triggered_count'] += 1
                            ind['triggered_enterprises'].append(ent['name'])
                            break
            except:
                pass

    conn.close()
    return list(indicators.values())


def get_indicator_summary():
    """获取指标维度汇总统计"""
    import json
    conn = get_conn()

    # 按维度统计
    domain_summary = {}
    try:
        with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rules_config.json'), 'r', encoding='utf-8') as f:
            rule_config = json.load(f)
    except:
        pass

    for domain_name, domain_cfg in rule_config.items():
        if domain_name == 'system': continue
        rules = domain_cfg.get('rules', [])
        domain_summary[domain_name] = {
            'domain': domain_name,
            'domain_name': domain_cfg.get('name', domain_name),
            'total_rules': len(rules),
            'red_line_count': sum(1 for r in rules if r.get('is_red_line', False)),
            'total_score': sum(r.get('score', 0) for r in rules)
        }

    # 获取企业评估汇总
    ent_summary = conn.execute("""
        SELECT enterprise_type, COUNT(*) as cnt,
               SUM(CASE WHEN risk_level='红色预警' THEN 1 ELSE 0 END) as red,
               SUM(CASE WHEN risk_level='橙色预警' THEN 1 ELSE 0 END) as orange,
               SUM(CASE WHEN risk_level='黄色预警' THEN 1 ELSE 0 END) as yellow,
               SUM(CASE WHEN risk_level='蓝色预警' THEN 1 ELSE 0 END) as blue,
               SUM(is_red_line) as red_line
        FROM enterprises GROUP BY enterprise_type
    """).fetchall()

    conn.close()

    type_summary = {}
    for row in ent_summary:
        type_summary[row['enterprise_type']] = {
            'type': row['enterprise_type'],
            'total': row['cnt'],
            'red': row['red'],
            'orange': row['orange'],
            'yellow': row['yellow'],
            'blue': row['blue'],
            'red_line': row['red_line']
        }

    return {
        'domain_summary': list(domain_summary.values()),
        'type_summary': type_summary
    }


def export_enterprises_by_indicator_category(category: str):
    """按预警指标维度分类导出企业数据"""
    conn = get_conn()
    rows = conn.execute("""
        SELECT e.id, e.name, e.credit_code, e.enterprise_type, e.district, e.industry,
               e.risk_score, e.risk_level, e.is_red_line, e.last_assessed_at,
               e.recommended_actions, e.risk_details, e.employee_count
        FROM enterprises e
        WHERE e.risk_score >= 0
        ORDER BY e.risk_score DESC
    """).fetchall()
    conn.close()

    result = []
    for row in rows:
        d = dict(row)
        d['is_red_line'] = bool(d.get('is_red_line', 0))
        try:
            details = json.loads(d.get('risk_details', '[]'))
        except:
            details = []

        matched = [item for item in details if item.get('category') == category]
        if matched:
            d['matched_indicators'] = matched
            d['matched_count'] = len(matched)
            result.append(d)

    return result


def export_enterprises_by_level(risk_level=None):
    """按风险等级导出企业数据"""
    conn = get_conn()
    conditions, params = [], []

    if risk_level and risk_level != 'all':
        conditions.append("risk_level = ?")
        params.append(risk_level)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = conn.execute(
        f"SELECT id, name, credit_code, enterprise_type, district, industry, "
        f"employee_count, risk_score, risk_level, is_red_line, last_assessed_at, "
        f"recommended_actions FROM enterprises{where} ORDER BY risk_score DESC",
        params
    ).fetchall()
    conn.close()

    result = []
    for row in rows:
        d = dict(row)
        d['is_red_line'] = bool(d.get('is_red_line', 0))
        result.append(d)
    return result


# ==================== 仪表盘 ====================

def get_dashboard_summary():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) as c FROM enterprises").fetchone()['c']
    assessed = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_score >= 0").fetchone()['c']
    red = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_level='红色预警'").fetchone()['c']
    orange = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_level='橙色预警'").fetchone()['c']
    yellow = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_level='黄色预警'").fetchone()['c']
    blue = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_level='蓝色预警'").fetchone()['c']
    red_line = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE is_red_line=1").fetchone()['c']
    unassessed = conn.execute("SELECT COUNT(*) as c FROM enterprises WHERE risk_score < 0").fetchone()['c']
    top10 = conn.execute("SELECT * FROM enterprises WHERE risk_score >= 0 ORDER BY risk_score DESC LIMIT 10").fetchall()
    conn.close()
    return {
        "total": total, "assessed": assessed, "unassessed": unassessed,
        "red": red, "orange": orange, "yellow": yellow, "blue": blue,
        "red_line_count": red_line,
        "top_risk": [row_to_dict(r) for r in top10]
    }

# ==================== 模拟数据 ====================

def seed_demo_data():
    conn = get_conn()
    existing = conn.execute("SELECT COUNT(*) as c FROM enterprises").fetchone()['c']
    if existing > 0:
        conn.close(); return
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    demos = [
        ("深圳市宏达精密制造有限公司","91440306MA5F1234X1","factory","新安街道","精密制造","张伟","13800001001",850),
        ("宝安区鑫源电子科技有限公司","91440306MA5F1234X2","factory","西乡街道","电子科技","李明","13800001002",320),
        ("深圳市恒通五金制品厂","91440306MA5F1234X3","factory","福永街道","五金制品","王强","13800001003",180),
        ("深圳市盛达服装加工有限公司","91440306MA5F1234X4","factory","沙井街道","服装加工","赵丽","13800001004",420),
        ("宝安区瑞祥商贸有限公司","91440306MA5F1234X5","factory","松岗街道","商贸物流","刘洋","13800001005",95),
        ("深圳市金鹏塑胶模具厂","91440306MA5F1234X6","factory","石岩街道","塑胶模具","陈刚","13800001006",260),
        ("宝安区华信通讯设备有限公司","91440306MA5F1234X7","factory","新安街道","通讯设备","周伟","13800001007",510),
        ("深圳市利达物流有限公司","91440306MA5F1234X8","factory","航城街道","物流运输","黄勇","13800001008",140),
        ("深圳市兴业纺织有限公司","91440306MA5F1234X9","factory","福海街道","纺织印染","杨芳","13800001009",380),
        ("宝安区聚能新材料科技有限公司","91440306MA5F1234A0","factory","西乡街道","新材料","吴磊","13800001010",200),
        ("中建三局宝安城市更新项目部","91440306MA5F2234B1","construction","新安街道","城市更新","林建","13800002001",1200),
        ("中铁十二局宝安地铁延长线项目","91440306MA5F2234B2","construction","西乡街道","轨道交通","马超","13800002002",2800),
        ("深圳市建工集团宝安中心区项目","91440306MA5F2234B3","construction","新安街道","商业综合体","孙亮","13800002003",950),
        ("中交二航局滨海大道改造项目","91440306MA5F2234B4","construction","航城街道","市政道路","郑涛","13800002004",600),
        ("宝安区保障性住房A地块项目部","91440306MA5F2234B5","construction","松岗街道","保障房建设","谢刚","13800002005",750),
        ("华润置地宝安湾区壹号项目","91440306MA5F2234B6","construction","沙井街道","住宅开发","曹明","13800002006",480),
        ("深圳市政院福永水质净化厂项目","91440306MA5F2234B7","construction","福永街道","环保工程","韩冰","13800002007",350),
        ("招商蛇口宝安科技园二期项目","91440306MA5F2234B8","construction","西乡街道","产业园区","范磊","13800002008",520),
        ("宝安区中心医院改扩建工程","91440306MA5F2234B9","construction","新安街道","医疗建筑","钟华","13800002009",410),
        ("深圳机场T4航站楼配套项目","91440306MA5F2234C0","construction","航城街道","交通枢纽","田军","13800002010",1500),
    ]
    for d in demos:
        conn.execute(
            "INSERT INTO enterprises (name,credit_code,enterprise_type,district,industry,contact_person,contact_phone,employee_count,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (*d, now)
        )
    conn.commit(); conn.close()

init_db()
seed_demo_data()
