const{createApp}=Vue;
document.body.classList.add('light');
createApp({
data(){return{
loggedIn:false,showLogin:false,loginForm:{username:'',password:''},loginError:'',loginLoading:false,
tab:'dashboard',
dash:{total:0,assessed:0,unassessed:0,red:0,orange:0,yellow:0,blue:0,red_line_count:0,top_risk:[]},
enterprises:{total:0,items:[]},
entSearch:'',entTypeFilter:'',entPage:1,
levelFilter:'all',
commonRules:[],factoryRules:[],constructionRules:[],commonName:'',factoryName:'',constructionName:'',
sysConfig:{},
indicators:[],
indicatorSummary:{domain_summary:[],type_summary:{}},
indDomainFilter:'',
showAddRule:false,showAddEnt:false,showAssess:false,showIndicators:false,showProfile:false,
profileData:null,
assessEnt:null,assessData:'{}',
expandedId:null,
expandedIndId:null,
drawerOpen:false,
newRule:{key:'',name:'',category:'',description:'',field:'',operator:'>=',threshold:0,score:10,is_red_line:false},
newEnt:{name:'',credit_code:'',enterprise_type:'factory',district:'',industry:'',contact_person:'',contact_phone:'',employee_count:0},
toast:{vis:false,msg:''},
isDark:false,
sysLabels:{api_host:'服务绑定地址',api_port:'服务端口号',api_title:'API文档标题',debug_mode:'调试模式',risk_red_threshold:'红色预警阈值',risk_orange_threshold:'橙色预警阈值',risk_yellow_threshold:'黄色预警阈值'}
}},
computed:{
rules(){return this.tab==='ruleCommon'?this.commonRules:this.tab==='ruleFactory'?this.factoryRules:this.constructionRules},
domainKey(){return this.tab==='ruleCommon'?'common':this.tab==='ruleFactory'?'factory':'construction'},
domainName(){return this.tab==='ruleCommon'?this.commonName:this.tab==='ruleFactory'?this.factoryName:this.constructionName},
filteredEnts(){
let list=this.enterprises.items||[];
if(this.levelFilter!=='all')list=list.filter(e=>e.risk_level===this.levelFilter);
return list;
},
levelCounts(){
const items=this.enterprises.items||[];
return{
red:items.filter(e=>e.risk_level==='红色预警').length,
orange:items.filter(e=>e.risk_level==='橙色预警').length,
yellow:items.filter(e=>e.risk_level==='黄色预警').length,
blue:items.filter(e=>e.risk_level==='蓝色预警').length
};},
filteredIndicators(){
if(!this.indDomainFilter)return this.indicators;
return this.indicators.filter(i=>i.domain===this.indDomainFilter);
}
},
watch:{
tab(val){
if(val==='indicators'){this.fetchIndicators();this.fetchIndicatorSummary()}
}
},
methods:{
tip(m){this.toast.msg=m;this.toast.vis=true;setTimeout(()=>this.toast.vis=false,3000)},
toggleTheme(){this.isDark=!this.isDark;document.body.classList.toggle('light',!this.isDark)},
badgeClass(l){if(l==='红色预警')return'badge-red';if(l==='橙色预警')return'badge-orange';if(l==='黄色预警')return'badge-yellow';if(l==='蓝色预警')return'badge-blue';return'badge-gray'},
async doLogin(){
if(!this.loginForm.username||!this.loginForm.password){this.loginError='请输入用户名和密码';return}
this.loginLoading=true;this.loginError='';
try{
const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.loginForm)});
if(r.ok){
sessionStorage.setItem('wage_admin_logged','1');
this.loggedIn=true;this.showLogin=false;
this.loginForm={username:'',password:''};
this.fetchAll();
this.tip('登录成功')
}else{
const d=await r.json();this.loginError=d.detail||'登录失败'
}
}catch(e){this.loginError='网络错误，请重试'}
this.loginLoading=false
},
logout(){
sessionStorage.removeItem('wage_admin_logged');
this.loggedIn=false;this.tab='dashboard';
this.tip('已退出管理')
},
async fetchDash(){
try{const r=await fetch('/api/v1/dashboard/summary');this.dash=await r.json()}catch(e){}
},
async fetchEnts(){
try{
let url=`/api/v1/enterprises?page=${this.entPage}&page_size=200`;
if(this.entSearch)url+=`&search=${encodeURIComponent(this.entSearch)}`;
if(this.entTypeFilter)url+=`&enterprise_type=${this.entTypeFilter}`;
const r=await fetch(url);this.enterprises=await r.json()
}catch(e){this.tip('企业列表加载失败')}
},
async fetchRules(){
try{
let r=await fetch('/api/v1/config/common');let d=await r.json();
this.commonRules=d.rules||[];this.commonName=d.name||'';
r=await fetch('/api/v1/config/factory');d=await r.json();
this.factoryRules=d.rules||[];this.factoryName=d.name||'';
r=await fetch('/api/v1/config/construction');d=await r.json();
this.constructionRules=d.rules||[];this.constructionName=d.name||'';
r=await fetch('/api/v1/config/system');this.sysConfig=await r.json()
}catch(e){this.tip('规则加载失败')}
},
async fetchIndicators(){
try{const r=await fetch('/api/v1/indicators');this.indicators=await r.json()}catch(e){}
},
async fetchIndicatorSummary(){
try{const r=await fetch('/api/v1/indicators/summary');this.indicatorSummary=await r.json()}catch(e){}
},
async fetchAll(){await Promise.all([this.fetchDash(),this.fetchEnts(),this.fetchRules(),this.fetchIndicators(),this.fetchIndicatorSummary()]);this.tip('数据加载完成')},
async exportData(level){
try{
const r=await fetch(`/api/v1/enterprises/export${level?'?risk_level='+encodeURIComponent(level):''}`);
if(!r.ok){this.tip('导出失败');return}
const blob=await r.blob();
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
const cd=r.headers.get('Content-Disposition')||'';
const m=cd.match(/filename="?([^"]+)"?;?/);
a.download=m?m[1]:'企业风险数据_'+(level||'all')+'.xlsx';
document.body.appendChild(a);a.click();
document.body.removeChild(a);URL.revokeObjectURL(url);
this.tip('导出成功')
}catch(e){this.tip('导出失败: '+e.message)}
},
async saveRule(rule){
try{
const r=await fetch(`/api/v1/config/${this.domainKey}/${rule.key}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(rule)});
if(r.ok)this.tip('指标「'+rule.name+'」保存成功');else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('保存失败')}
},
async deleteRule(key,name){
if(!confirm('确定删除指标「'+name+'」？'))return;
try{const r=await fetch(`/api/v1/config/${this.domainKey}/${key}`,{method:'DELETE'});if(r.ok){this.tip('已删除');this.fetchRules()}}catch(e){this.tip('删除失败')}
},
async addRule(){
if(!this.newRule.key||!this.newRule.name){this.tip('请填写标识和名称');return}
try{
const r=await fetch(`/api/v1/config/${this.domainKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.newRule)});
if(r.ok){this.tip('新增成功');this.showAddRule=false;this.newRule={key:'',name:'',category:'',description:'',field:'',operator:'>=',threshold:0,score:10,is_red_line:false};this.fetchRules()}
else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('新增失败')}
},
async saveSys(){
try{const r=await fetch('/api/v1/config/system',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.sysConfig)});if(r.ok)this.tip('系统配置已保存')}catch(e){this.tip('保存失败')}
},
async addEnt(){
if(!this.newEnt.name||!this.newEnt.credit_code){this.tip('企业名称和信用代码必填');return}
try{
const r=await fetch('/api/v1/enterprises',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.newEnt)});
if(r.ok){this.tip('企业录入成功');this.showAddEnt=false;this.newEnt={name:'',credit_code:'',enterprise_type:'factory',district:'',industry:'',contact_person:'',contact_phone:'',employee_count:0};this.fetchEnts();this.fetchDash()}
else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('录入失败')}
},
async delEnt(id,name){
if(!confirm('确定删除企业「'+name+'」？'))return;
try{const r=await fetch(`/api/v1/enterprises/${id}`,{method:'DELETE'});if(r.ok){this.tip('已删除');this.fetchEnts();this.fetchDash()}}catch(e){this.tip('删除失败')}
},
openAssess(ent){this.assessEnt=ent;this.assessData=JSON.stringify(ent.raw_data||{},null,2);this.showAssess=true},
async doAssess(){
try{
const data=JSON.parse(this.assessData);
const r=await fetch(`/api/v1/enterprises/${this.assessEnt.id}/assess`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
if(r.ok){this.tip('评估完成');this.showAssess=false;this.fetchEnts();this.fetchDash()}
else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('JSON格式错误或请求失败')}
},
async openProfile(eid){
  try{
    const r=await fetch(`/api/v1/enterprises/${eid}/profile`);
    if(!r.ok) { this.tip('加载画像失败'); return; }
    this.profileData=await r.json();
    this.showProfile=true;
    this.$nextTick(()=>{ this.renderCharts(); });
  }catch(e){ this.tip('加载画像失败') }
},
renderCharts(){
  if(!this.profileData) return;
  const trendEl = document.getElementById('trendChart');
  const radarEl = document.getElementById('radarChart');
  if(trendEl) {
    const trendChart = echarts.init(trendEl);
    let hist = this.profileData.history || [];
    if(hist.length > 6) hist = hist.slice(hist.length - 6);
    const dates = hist.map(h => h.assessed_at.substring(5, 10));
    const scores = hist.map(h => h.risk_score);
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      xAxis: { type: 'category', data: dates.length ? dates : ['无历史'] },
      yAxis: { type: 'value', min: 0 },
      series: [{ data: scores.length ? scores : [0], type: 'line', smooth: true, itemStyle: { color: '#00c3ff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1, [{offset:0,color:'rgba(0,195,255,0.5)'},{offset:1,color:'rgba(0,195,255,0)'}]) } }]
    });
  }
  if(radarEl) {
    const radarChart = echarts.init(radarEl);
    const radar = this.profileData.radar || [];
    const maxVal = Math.max(10, ...radar.map(r => r.value)) + 10;
    radarChart.setOption({
      tooltip: { trigger: 'item' },
      radar: {
        indicator: radar.length ? radar.map(r => ({ name: r.name, max: maxVal })) : [{name:'无配置', max:100}],
        radius: '65%',
        name: { textStyle: { color: this.isDark ? '#aaa' : '#666', fontSize: 10 } }
      },
      series: [{
        type: 'radar',
        data: [{ value: radar.map(r => r.value), name: '扣分分布', itemStyle: { color: '#ff4d4f' }, areaStyle: { color: 'rgba(255,77,79,0.3)' } }]
      }]
    });
  }
},
async batchAssess(){
if(!confirm('将对所有有原始数据的企业重新执行评估，是否继续？'))return;
try{const r=await fetch('/api/v1/enterprises/batch-assess',{method:'POST'});const d=await r.json();this.tip(d.message);this.fetchEnts();this.fetchDash()}catch(e){this.tip('批量评估失败')}
},
toggleExpand(id){this.expandedId=this.expandedId===id?null:id},
async exportIndicators(){
try{
this.tip('正在导出…');
const r=await fetch('/api/v1/indicators/export');
if(!r.ok){this.tip('导出失败');return}
const blob=await r.blob();
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
const cd=r.headers.get('Content-Disposition')||'';
const m=cd.match(/filename\*?="?([^";]+)"?;?/);
a.download=m?m[1]:'wage_arrears_indicators.xlsx';
document.body.appendChild(a);a.click();
document.body.removeChild(a);URL.revokeObjectURL(url);
this.tip('指标导出成功')
}catch(e){this.tip('导出失败: '+e.message)}
},
},
mounted(){
document.body.classList.add('light');
this.loggedIn=sessionStorage.getItem('wage_admin_logged')==='1';
this.fetchDash();
if(this.loggedIn){this.fetchAll()}
}
}).mount('#app');
