from pydantic import BaseModel, Field
from typing import List, Optional

# -----------------------------------
# 响应模型 (Output Schemas)
# -----------------------------------

class ScoringDetail(BaseModel):
    category: str = Field(..., title="预警维度分类", description="指标所属的大维度")
    five_category: Optional[str] = Field("", title="五维分类", description="评分体系中的五维分类")
    item_name: str = Field(..., title="预警指标名称", description="具体的指标名称")
    score: int = Field(..., title="风险判定得分", description="该项指标被评估出的风险得分")
    description: str = Field(..., title="规则命中说明", description="触发加分的具体原因说明")

class RiskAssessmentResponse(BaseModel):
    total_score: int = Field(..., title="综合风险总分", description="按适用指标归一化后的综合风险评分（0-100）")
    risk_level: str = Field(..., title="风险预警等级", description="蓝色/黄色/橙色/红色预警")
    is_red_line_triggered: bool = Field(..., title="是否触发一票否决", description="是否命中极高风险红线指标")
    details: List[ScoringDetail] = Field(..., title="扣分项详细清单", description="模型命中的所有加分规则详情")
    recommended_actions: str = Field(..., title="建议响应与处置动作", description="对应分级的闭环处置建议")

# -----------------------------------
# 规则定义模型 (Rule Definition)
# -----------------------------------

class RuleDefinition(BaseModel):
    key: str = Field(..., title="指标标识", description="用于API对接的英文字段标识符")
    name: str = Field(..., title="指标名称", description="指标的完整中文名称")
    category: str = Field(..., title="所属维度", description="该指标所属的大维度分类")
    five_category: Optional[str] = Field("", title="五维分类", description="评分体系中的五维分类")
    description: str = Field(..., title="指标说明", description="该指标的详细业务含义及调整说明")
    scoring_rule: Optional[str] = Field("", title="扣分规则", description="展示给前端的评分规则说明")
    field: str = Field(..., title="数据字段", description="对接方传入JSON中对应的字段名")
    operator: str = Field(..., title="判断运算符", description="触发条件的运算符，支持: >=, <=, >, <, ==, !=")
    threshold: object = Field(..., title="触发阈值", description="当数据字段的值满足运算符与阈值的条件时触发")
    score: int = Field(..., title="风险分值", description="触发后增加的风险分数")
    threshold_t2: Optional[object] = Field(None, title="T2触发阈值", description="更高档位的二级阈值")
    score_t2: Optional[int] = Field(None, title="T2风险分值", description="命中二级阈值后的风险分值")
    is_red_line: bool = Field(False, title="一票否决红线", description="触发后是否直接定级为红色预警")
    source: Optional[str] = Field("", title="数据来源", description="指标采集来源")
