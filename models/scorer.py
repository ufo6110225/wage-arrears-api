import json
import os
from .schemas import RiskAssessmentResponse, ScoringDetail

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rules_config.json')


def load_config():
    """从 JSON 配置文件加载全部规则"""
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_config(config: dict):
    """将配置写回 JSON 文件"""
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def evaluate_rule(rule: dict, data: dict) -> bool:
    """
    动态规则求值引擎。
    根据规则定义中的 field、operator、threshold，
    从传入的数据字典中提取对应字段值并进行逻辑判断。
    """
    field = rule.get('field', '')
    value = data.get(field)

    if value is None:
        return False

    op = rule.get('operator', '>=')
    threshold = rule.get('threshold', 0)

    try:
        if op == '>=':
            return float(value) >= float(threshold)
        elif op == '<=':
            return float(value) <= float(threshold)
        elif op == '>':
            return float(value) > float(threshold)
        elif op == '<':
            return float(value) < float(threshold)
        elif op == '==':
            # 支持布尔值和数值的直接比较
            if isinstance(threshold, bool):
                return bool(value) == threshold
            return value == threshold
        elif op == '!=':
            if isinstance(threshold, bool):
                return bool(value) != threshold
            return value != threshold
        else:
            return False
    except (ValueError, TypeError):
        return False


def get_risk_level_and_actions(total_score: int, is_red_line_triggered: bool, score_pct: float = 0, thresholds: dict = None) -> tuple:
    """根据总分百分比和红线标志判定风险等级及建议处置动作"""
    if thresholds is None:
        thresholds = {'red': 55, 'orange': 40, 'yellow': 25}
    if is_red_line_triggered or score_pct >= thresholds.get('red', 55):
        return ("红色预警",
                "提级督办与行刑衔接。启动提级督办应急预案；动用应急资金垫付；"
                "公安机关提前介入；全面启动联合惩戒。")
    elif score_pct >= thresholds.get('orange', 40):
        return ("橙色预警",
                "执法介入与领导包干。实施街道领导包干现场督导；"
                "专项执法组进驻查封账本核实；实施一案双查。")
    elif score_pct >= thresholds.get('yellow', 25):
        return ("黄色预警",
                "社区介入与限期整改。启动街道综治中心及调解组织排查；"
                "下发《责令限期整改通知书》。")
    else:
        return ("蓝色预警",
                "源头宣教与柔性自纠。自动发送政务短信提醒要求自查自纠；"
                "社区网格员日常走访政策宣讲。")


def calculate_risk(domain: str, data: dict) -> RiskAssessmentResponse:
    """
    全动态风险评估核心函数。
    
    参数:
        domain: 领域标识，如 'factory' 或 'construction'
        data: 对接方传入的任意键值对数据字典
    
    返回:
        RiskAssessmentResponse: 包含总分、等级、详情的完整评估结果
    """
    config = load_config()
    
    # 获取通用规则和领域特定规则
    common_rules = config.get('common', {}).get('rules', [])
    domain_rules = config.get(domain, {}).get('rules', []) if domain in config else []
    
    rules = common_rules + domain_rules

    # 满分 = 所有非红线指标的分数之和
    max_possible_score = sum(r.get('score', 0) for r in rules if not r.get('is_red_line', False))

    details = []
    total_score = 0
    is_red_line_triggered = False

    for rule in rules:
        if evaluate_rule(rule, data):
            score = rule.get('score', 0)
            is_red_line = rule.get('is_red_line', False)

            if score > 0 or is_red_line:
                details.append(ScoringDetail(
                    category=rule.get('category', '未分类'),
                    item_name=rule.get('name', '未命名指标'),
                    score=score,
                    description=rule.get('description', '')
                ))
                total_score += score

            if is_red_line:
                is_red_line_triggered = True

    score_pct = (total_score / max_possible_score * 100) if max_possible_score > 0 else 0
    system_cfg = config.get('system', {})
    thresholds = system_cfg.get('risk_thresholds', {'red': 55, 'orange': 40, 'yellow': 25})
    risk_level, actions = get_risk_level_and_actions(total_score, is_red_line_triggered, score_pct, thresholds)

    return RiskAssessmentResponse(
        total_score=total_score,
        risk_level=risk_level,
        is_red_line_triggered=is_red_line_triggered,
        details=details,
        recommended_actions=actions
    )
