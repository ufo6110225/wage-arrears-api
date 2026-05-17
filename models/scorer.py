import json
import os
import re
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


def _coerce_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        val = value.strip().lower()
        if val in ('true', '1', 'yes', 'y', '是'):
            return True
        if val in ('false', '0', 'no', 'n', '否', ''):
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return bool(value)


def _normalize_operator_threshold(rule: dict) -> tuple:
    op = rule.get('operator', '>=')
    threshold = rule.get('threshold', 0)
    if isinstance(threshold, bool) and op not in ('==', '!='):
        op = '=='
    return op, threshold


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

    op, threshold = _normalize_operator_threshold(rule)

    try:
        if isinstance(threshold, bool):
            value_bool = _coerce_bool(value)
            if op == '==':
                return value_bool == threshold
            if op == '!=':
                return value_bool != threshold
            return False
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


def _max_rule_score(rule: dict) -> int:
    score = rule.get('score', 0) or 0
    score_t2 = rule.get('score_t2')
    if score_t2 in (None, ''):
        return int(score)
    try:
        return max(int(score), int(score_t2))
    except (TypeError, ValueError):
        return int(score)


def get_risk_level_and_actions(total_score: int, is_red_line_triggered: bool, thresholds: dict = None) -> tuple:
    """根据归一化风险评分和红线标志判定风险等级及建议处置动作。"""
    thresholds = thresholds or {}
    red_threshold = int(thresholds.get('red', 20) or 20)
    yellow_threshold = int(thresholds.get('yellow', 16) or 16)
    blue_threshold = int(thresholds.get('blue', 10) or 10)

    if is_red_line_triggered or total_score >= red_threshold:
        return ("红色预警",
                "提级督办与行刑衔接。启动提级督办应急预案；动用应急资金垫付；"
                "公安机关提前介入；全面启动联合惩戒。")
    elif total_score >= yellow_threshold:
        return ("黄色预警",
                "执法介入与限期整改。实施街道领导包干现场督导；"
                "下发《责令限期整改通知书》；启动联合惩戒程序。")
    elif total_score >= blue_threshold:
        return ("蓝色预警",
                "社区介入与常规关注。启动街道综治中心及调解组织排查；"
                "社区网格员日常走访政策宣讲；下发预警提醒函。")
    else:
        return ("绿色预警",
                "源头宣教与柔性自纠。自动发送政务短信提醒要求自查自纠；"
                "社区网格员日常走访政策宣讲；按季度巡检监控。")


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
    thresholds = config.get('system', {}).get('risk_thresholds', {})
    
    # 获取通用规则和领域特定规则
    common_rules = config.get('common', {}).get('rules', [])
    domain_rules = []
    if domain in config and domain != 'common':
        domain_rules = config.get(domain, {}).get('rules', [])
    
    rules = common_rules + domain_rules

    # 满分 = 该领域所有适用非红线指标的最高档位分数之和
    max_possible_score = sum(_max_rule_score(r) for r in rules if not r.get('is_red_line', False))

    details = []
    total_deduction = 0
    is_red_line_triggered = False

    for rule in rules:
        if evaluate_rule(rule, data):
            # Evaluate T2 score if applicable
            score = rule.get('score', 0)
            if 'score_t2' in rule and 'threshold_t2' in rule:
                # Create a temporary rule for T2 evaluation
                t2_rule = rule.copy()
                t2_rule['threshold'] = rule['threshold_t2']
                # Try to figure out the operator for T2, usually the same as T1 but we should support parsing it if it contains an operator
                t2_op = rule.get('operator', '>=')
                t2_th = rule['threshold_t2']
                
                # Check if threshold_t2 contains an operator like ">80" or "<5"
                op_match = re.match(r'([><=]+)\s*(.+)', str(t2_th))
                if op_match:
                    t2_rule['operator'] = op_match.group(1)
                    t2_rule['threshold'] = op_match.group(2)
                
                if evaluate_rule(t2_rule, data):
                    score = rule.get('score_t2', score)
                    
            is_red_line = rule.get('is_red_line', False)

            if score > 0 or is_red_line:
                details.append(ScoringDetail(
                    category=rule.get('category', '未分类'),
                    five_category=rule.get('five_category', ''),
                    item_name=rule.get('name', '未命名指标'),
                    score=score,
                    description=rule.get('description', '')
                ))
                total_deduction += score

            if is_red_line:
                is_red_line_triggered = True

    final_score = round((total_deduction / max_possible_score) * 100) if max_possible_score > 0 else 0
    if is_red_line_triggered:
        final_score = max(final_score, 80)
    risk_level, actions = get_risk_level_and_actions(final_score, is_red_line_triggered, thresholds)

    return RiskAssessmentResponse(
        total_score=final_score,
        risk_level=risk_level,
        is_red_line_triggered=is_red_line_triggered,
        details=details,
        recommended_actions=actions
    )
