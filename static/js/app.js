const{createApp}=Vue;
document.body.classList.add('light');
createApp({
data(){return{
loggedIn:false,showLogin:false,loginForm:{username:'',password:''},loginError:'',loginLoading:false,
tab:'dashboard',
dash:{total:0,assessed:0,unassessed:0,red:0,yellow:0,blue:0,green:0,red_line_count:0,top_risk:[]},
enhancedDash:{trend:[],districts:[],latest_assessments:[]},
enterprises:{total:0,items:[]},
entSearch:'',entTypeFilter:'',entDistrictFilter:'',entPage:1,entPageSize:50,batchAssessing:false,batchResult:null,batchIndicatorQueue:[],batchIndicatorTimer:null,batchPhase:'',batchQueueIdx:0,batchScrollTimer:null,batchPhaseTimer:null,batchHideTimer:null,batchStatusText:'',showManualEntry:false,
levelFilter:'all',
commonRules:[],factoryRules:[],constructionRules:[],commonName:'',factoryName:'',constructionName:'',
sysConfig:{},
indicators:[],highRiskIndicators:[],
indicatorSummary:{domain_summary:[],type_summary:{}},
indDomainFilter:'',
showAddRule:false,showAddEnt:false,showAssess:false,showIndicators:false,showUploadIndicators:false,
profileData:null,profileEnterpriseId:null,expandedGroups:{},
profilePool:{items:[],total:0,loading:false},
psSearch:'',psLevel:'all',psDistrict:'',psType:'',
assessEnt:null,assessData:'{}',
expandedId:null,expandedIndId:null,expandedIndCatId:null,
drawerOpen:false,
newRule:{key:'',name:'',category:'',five_category:'',description:'',scoring_rule:'',field:'',operator:'>=',threshold:0,score:10,threshold_t2:'',score_t2:null,is_red_line:false,source:''},
newEnt:{name:'',credit_code:'',enterprise_type:'factory',district:'',industry:'',contact_person:'',contact_phone:'',employee_count:0},
toast:{vis:false,msg:''},
isDark:false,
bigscreen:{active:false,view:0,views:5,timer:null},bsChartRendered:false,
pageTransitionName:'page-fade',
pageTransitionReady:false,
sortField:"",sortDir:"asc",
entViewMode:"card",
uploadIndicatorFile:null,uploadIndicatorUploading:false,uploadIndicatorResult:null,
registryFile:null,registryUploading:false,registryResult:null,
greenCount:0,dashboardChartsRendered:false,donutActiveLevel:null,
sysLabels:{api_host:'服务绑定地址',api_port:'服务端口号',api_title:'API文档标题',debug_mode:'调试模式',risk_red_threshold:'红色预警阈值',risk_yellow_threshold:'黄色预警阈值',risk_blue_threshold:'蓝色预警阈值',risk_green_threshold:'绿色预警阈值'}
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
if(this.dash&&this.dash.total){
return{
red:this.dash.red||0,
yellow:this.dash.yellow||0,
blue:this.dash.blue||0,
green:this.dash.green||0
};}
const items=this.enterprises.items||[];
return{
red:items.filter(e=>e.risk_level==='红色预警').length,
yellow:items.filter(e=>e.risk_level==='黄色预警').length,
blue:items.filter(e=>e.risk_level==='蓝色预警').length,
green:items.filter(e=>e.risk_level==='绿色预警').length
};},
filteredIndicators(){
if(!this.indDomainFilter)return this.indicators;
return this.indicators.filter(i=>i.domain===this.indDomainFilter);
},
donutDistrictBreakdown(){if(!this.donutActiveLevel)return[];var m={'红色预警':'red','黄色预警':'yellow','蓝色预警':'blue','绿色预警':'green'};var f=m[this.donutActiveLevel];if(!f)return[];var ds=this.enhancedDash.districts||[];return ds.map(function(d){return{name:d.district,count:d[f]||0}}).filter(function(d){return d.count>0}).sort(function(a,b){return b.count-a.count});},
filteredTriggeredIndicators(){
return this.indicators.filter(function(i){return i.triggered_count>0});
},
batchVisibleIndicators(){
const list=this.batchIndicatorQueue||[];
if(!list.length)return [];
const active=Math.max(0,Math.min(this.batchQueueIdx,list.length-1));
const start=Math.max(0,Math.min(active-2,Math.max(0,list.length-5)));
return list.slice(start,start+5).map(function(name,idx){
const absoluteIndex=start+idx;
return{name:name,index:absoluteIndex,distance:Math.abs(absoluteIndex-active),active:absoluteIndex===active};
});
},
triggeredIndicatorsCount(){
return this.indicators.filter(function(i){return i.triggered_count>0}).length;
},
totalIndicatorRedLines(){
const type=this.indicatorSummary?.type_summary||{};
const factory=type.factory?.red_line||0;
const construction=type.construction?.red_line||0;
return factory+construction;
},
indicatorCategoryNames(){
return Array.from(new Set((this.indicators||[]).map(function(i){return i.category}).filter(Boolean)));
},
indicatorFiveCategoryNames(){
return Array.from(new Set((this.indicators||[]).map(function(i){return i.five_category}).filter(Boolean)));
},
psFilteredEnts(){
let source=this.profilePool.items&&this.profilePool.items.length?this.profilePool.items:(this.enterprises.items||[]);
let list=source.filter(e=>{
if(this.psSearch){
const q=this.psSearch.toLowerCase();
if(!e.name.toLowerCase().includes(q)&&!e.credit_code.toLowerCase().includes(q))return false;
}
if(this.psLevel!=='all'&&e.risk_level!==this.psLevel)return false;
if(this.psDistrict&&e.district!==this.psDistrict)return false;
if(this.psType&&e.enterprise_type!==this.psType)return false;
return true;
});
return list;
},
psDistrictList(){
const ds=new Set();
(this.profilePool.items&&this.profilePool.items.length?this.profilePool.items:(this.enterprises.items||[])).forEach(e=>{if(e.district)ds.add(e.district)});
return Array.from(ds).sort();
},
groupedRiskDetails(){
const details=this.profileData?.enterprise?.risk_details||[];
const groups={};
details.forEach(d=>{
const cat=d.category||'其他';
if(!groups[cat])groups[cat]={category:cat,totalScore:0,items:[]};
groups[cat].totalScore+=d.score||0;
groups[cat].items.push(d);
});
return Object.values(groups);
},
profileIndex(){
const list=this.psFilteredEnts;
return list.findIndex(e=>String(e.id)===String(this.profileEnterpriseId));
},
profileEnterpriseIds(){return this.psFilteredEnts.map(e=>e.id);},
prevProfileName(){
const list=this.psFilteredEnts;
const idx=this.profileIndex;
return idx>0&&list[idx-1]?list[idx-1].name:'';
},
nextProfileName(){
const list=this.psFilteredEnts;
const idx=this.profileIndex;
return idx>=0&&idx<list.length-1&&list[idx+1]?list[idx+1].name:'';
},
indicatorCategories(){
var cats=new Set();
this.indicators.forEach(function(i){if(i.triggered_count>0)cats.add(i.category)});
return Array.from(cats);
},
pageNumbers(){
var total=Math.ceil((this.enterprises.total||0)/this.entPageSize);
var arr=[];for(var i=1;i<=total;i++)arr.push(i);return arr;
},
rulesRedLineCount(){
return (this.rules||[]).filter(function(rule){return !!rule.is_red_line}).length;
},
rulesT2Count(){
return (this.rules||[]).filter(function(rule){return rule.threshold_t2!==undefined&&rule.threshold_t2!==null&&rule.threshold_t2!==''}).length;
},
pageTransitionKey(){
if(this.tab==='profile')return 'profile-'+(this.profileEnterpriseId||'');
return this.tab;
}
},
watch:{
tab(val){
 if(val==='indicators'){this.ensureIndicatorsLoaded()}
 if(val==='dashboard'){var self=this;this.$nextTick(function(){self.renderAllDashboardCharts()})}
 if(val==='profile'){if(!this.enterprises.items.length){this.fetchEnts()}this.ensureProfilePoolLoaded()}
 }
},
methods:{
tip(m){this.toast.msg=m;this.toast.vis=true;setTimeout(()=>this.toast.vis=false,3000)},
toggleTheme(){this.isDark=!this.isDark;document.body.classList.toggle('light',!this.isDark)},
getViewOrder(tab){
var orderMap={
dashboard:0,
indicators:1,
enterprises:2,
profile:2,
ruleCommon:3,
ruleFactory:3,
ruleConstruction:3,
system:4
};
return Object.prototype.hasOwnProperty.call(orderMap,tab)?orderMap[tab]:0;
},
setPageTransition(nextTab){
if(!this.pageTransitionReady){
this.pageTransitionName='page-fade';
this.pageTransitionReady=true;
return;
}
var current=this.getViewOrder(this.tab);
var next=this.getViewOrder(nextTab);
if(next===current){
this.pageTransitionName='page-slide-forward';
return;
}
this.pageTransitionName=next>current?'page-slide-forward':'page-slide-backward';
},
ensureIndicatorsLoaded(){
var tasks=[];
if(!this.indicators.length)tasks.push(this.fetchIndicators());
if(!this.indicatorSummary||!this.indicatorSummary.domain_summary||!this.indicatorSummary.domain_summary.length)tasks.push(this.fetchIndicatorSummary());
if(this.loggedIn&&!this.highRiskIndicators.length)tasks.push(this.fetchHighRiskIndicators());
return tasks.length?Promise.all(tasks):Promise.resolve();
},
ensureProfilePoolLoaded(){
if(this.profilePool.items&&this.profilePool.items.length)return Promise.resolve(this.profilePool.items);
return this.fetchProfilePool();
},
handlePageTransitionAfterEnter(){
var self=this;
this.$nextTick(function(){
if(self.tab==='dashboard'){
self.renderAllDashboardCharts();
return;
}
if(self.tab==='indicators'){
self.renderHighRiskChart();
return;
}
if(self.tab==='profile'){
self.renderCharts();
}
});
},
isNavActive(section){
if(section==='enterprises')return this.tab==='enterprises'||this.tab==='profile';
if(section==='rules')return this.tab&&this.tab.indexOf('rule')===0;
return this.tab===section
},
buildRoute(tab,opts){
opts=opts||{};
if(tab==='dashboard')return'#/dashboard';
if(tab==='indicators')return'#/indicators';
if(tab==='enterprises')return'#/enterprises';
if(tab==='profile')return'#/enterprises/'+(opts.enterpriseId||this.profileEnterpriseId||'');
if(tab==='ruleCommon')return'#/rules/common';
if(tab==='ruleFactory')return'#/rules/factory';
if(tab==='ruleConstruction')return'#/rules/construction';
if(tab==='system')return'#/system';
return'#/dashboard'
},
parseRoute(){
var hash=(window.location.hash||'#/dashboard').replace(/^#/,'');
var clean=hash.charAt(0)==='/'?hash:'/'+hash;
var parts=clean.split('/').filter(Boolean);
if(!parts.length)return{tab:'dashboard'};
if(parts[0]==='dashboard')return{tab:'dashboard'};
if(parts[0]==='indicators')return{tab:'indicators'};
if(parts[0]==='enterprises'&&parts[1])return{tab:'profile',enterpriseId:parts[1]};
if(parts[0]==='enterprises')return{tab:'enterprises'};
if(parts[0]==='rules'){
if(parts[1]==='factory')return{tab:'ruleFactory'};
if(parts[1]==='construction')return{tab:'ruleConstruction'};
return{tab:'ruleCommon'}
}
if(parts[0]==='system')return{tab:'system'};
return{tab:'dashboard'}
},
async applyRoute(route,opts){
opts=opts||{};
if(!route)route=this.parseRoute();
var target=route.tab||'dashboard';
if((target==='ruleCommon'||target==='ruleFactory'||target==='ruleConstruction'||target==='system')&&!this.loggedIn){
this.showLogin=true;
target='dashboard';
if(!opts.fromNavigate)this.navigateTo('dashboard',{replace:true});
}
if(target==='profile'&&route.enterpriseId){
this.setPageTransition('profile');
await this.openProfile(route.enterpriseId,{skipRoute:true});
}else{
this.setPageTransition(target);
this.tab=target;
if(target==='enterprises'&&!this.enterprises.items.length)await this.fetchEnts();
 if(target==='indicators')await this.ensureIndicatorsLoaded();
}
this.drawerOpen=false;
window.scrollTo({top:0,behavior:'auto'});
},
navigateTo(tab,opts){
opts=opts||{};
var next=this.buildRoute(tab,opts);
if(window.location.hash!==next){
if(opts.replace){window.location.replace(next);return}
window.location.hash=next;
return;
}
this.applyRoute({tab:tab,enterpriseId:opts.enterpriseId},{fromNavigate:true});
},
badgeClass(l){
if(l==='红色预警')return'badge-red';
if(l==='黄色预警')return'badge-yellow';
if(l==='蓝色预警')return'badge-blue';
if(l==='绿色预警')return'badge-green';
return'badge-gray'
},
enterpriseTypeText(type){
return type==='factory'?'制造业/服务业':'工程建设'
},
enterpriseTypeShort(type){
return type==='factory'?'工厂':'工地'
},
getDistrictCoords(){
return{
'新安街道':[113.920,22.566],'西乡街道':[113.865,22.570],'福永街道':[113.810,22.650],
'沙井街道':[113.790,22.680],'松岗街道':[113.830,22.720],'石岩街道':[113.930,22.630],
'福海街道':[113.800,22.655],'新桥街道':[113.805,22.695],'燕罗街道':[113.845,22.740],
'航城街道':[113.835,22.590]
}
},
getStreetRiskAggregation(){
var coords=this.getDistrictCoords();
var districts=(this.enhancedDash&&Array.isArray(this.enhancedDash.districts)?this.enhancedDash.districts:[]).filter(function(d){
return Number(d.red||0)>0&&coords[d.district]
});
if(districts.length){
return districts.map(function(d){
return{district:d.district,count:Number(d.red||0),coords:coords[d.district]}
}).sort(function(a,b){return b.count-a.count})
}
var counts={};
(this.enterprises.items||[]).forEach(function(e){
if(e.risk_level!=='红色预警')return;
if(!coords[e.district])return;
counts[e.district]=(counts[e.district]||0)+1;
});
return Object.keys(counts).map(function(name){
return{district:name,count:counts[name],coords:coords[name]}
}).sort(function(a,b){return b.count-a.count})
},
disposeAmapMap(mapKey,clusterKey){
if(this[clusterKey]){
try{this[clusterKey].setMap&&this[clusterKey].setMap(null)}catch(e){}
try{this[clusterKey].clearMarkers&&this[clusterKey].clearMarkers()}catch(e){}
this[clusterKey]=null;
}
if(this[mapKey]){
try{this[mapKey].destroy()}catch(e){}
this[mapKey]=null;
}
},
mountStreetRiskMap(container,mapKey,clusterKey){
if(!container)return;
this.disposeAmapMap(mapKey,clusterKey);
container.innerHTML='';
if(typeof AMap==='undefined'){
container.innerHTML='<div class="map-empty-state">高德地图加载失败，请检查网络或 Key 配置</div>';
return;
}
var inner=document.createElement('div');
inner.style.width='100%';
inner.style.height='100%';
container.appendChild(inner);
var map=new AMap.Map(inner,{
center:[113.865,22.635],
zoom:11.4,
resizeEnable:true,
zoomEnable:true,
dragEnable:true,
mapStyle:'amap://styles/normal',
showLabel:true,
isHotspot:true
});
this[mapKey]=map;
if(typeof AMap.ToolBar==='function'){map.addControl(new AMap.ToolBar({position:'RB'}))}
if(typeof AMap.Scale==='function'){map.addControl(new AMap.Scale())}
var rows=this.getStreetRiskAggregation();
if(!rows.length){return}
function mkCircleUrl(size){
return'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+(size/2-3)+'" fill="#dc2626" fill-opacity="0.92" stroke="#ffffff" stroke-width="3"/></svg>')
}
var markers=[];
rows.forEach(function(row){
for(var i=0;i<row.count;i++){
var angle=(Math.PI*2*i)/Math.max(row.count,1);
var ring=0.0022+(0.00032*Math.floor(i/8));
var lng=row.coords[0]+Math.cos(angle)*ring;
var lat=row.coords[1]+Math.sin(angle)*ring*0.76;
markers.push(new AMap.Marker({
position:[lng,lat],
content:'<div class="map-red-dot"></div>',
offset:new AMap.Pixel(-7,-7),
zIndex:50,
title:row.district+' · 红色预警 '+row.count+' 家'
}));
}
});
if(!markers.length){return}
var self=this;
function fallbackMarkers(){
rows.forEach(function(row){
var sz=Math.min(36+row.count*2,72);
var marker=new AMap.Marker({
position:row.coords,
content:'<div class="map-red-circle-inner" style="width:'+sz+'px;height:'+sz+'px;font-size:'+Math.min(18,11+row.count*0.18)+'px">'+row.count+'</div>',
offset:new AMap.Pixel(-Math.floor(sz/2),-Math.floor(sz/2)),
zIndex:120,
title:row.district+' · 红色预警 '+row.count+' 家'
});
marker.setMap(map);
});
map.setFitView();
}
function buildCluster(){
try{
self[clusterKey]=new AMap.MarkerClusterer(map,markers,{
gridSize:80,
maxZoom:17,
styles:[
{url:mkCircleUrl(42),size:new AMap.Size(42,42),offset:new AMap.Pixel(-21,-21),textColor:'#fff',textSize:12},
{url:mkCircleUrl(56),size:new AMap.Size(56,56),offset:new AMap.Pixel(-28,-28),textColor:'#fff',textSize:14},
{url:mkCircleUrl(70),size:new AMap.Size(70,70),offset:new AMap.Pixel(-35,-35),textColor:'#fff',textSize:16}
]});
map.setFitView();
}catch(e){
fallbackMarkers()
}
}
if(typeof AMap.MarkerClusterer!=='undefined'){buildCluster()}
else if(typeof AMap.plugin==='function'){AMap.plugin('AMap.MarkerClusterer',function(){buildCluster()})}
else{fallbackMarkers()}
},
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
this.applyRoute(this.parseRoute());
this.tip('登录成功')
}else{
const d=await r.json();this.loginError=d.detail||'登录失败'
}
}catch(e){this.loginError='网络错误，请重试'}
this.loginLoading=false
},
logout(){
sessionStorage.removeItem('wage_admin_logged');
this.loggedIn=false;this.navigateTo('dashboard');
this.tip('已退出管理')
},
async fetchDash(){
try{const r=await fetch('/api/v1/dashboard/summary');this.dash=await r.json()}catch(e){}
},
async fetchEnhancedDash(){
try{const r=await fetch('/api/v1/dashboard/enhanced');this.enhancedDash=await r.json()}catch(e){}
},
async fetchEnts(){
try{
let lvl=this.levelFilter;if(lvl==='all')lvl='';let url='/api/v1/enterprises?page='+this.entPage+'&page_size='+this.entPageSize;if(lvl)url+='&risk_level='+encodeURIComponent(lvl);
if(this.entSearch)url+='&search='+encodeURIComponent(this.entSearch);
if(this.entTypeFilter)url+='&enterprise_type='+this.entTypeFilter;
if(this.entDistrictFilter)url+='&district='+encodeURIComponent(this.entDistrictFilter);
const r=await fetch(url);this.enterprises=await r.json()
}catch(e){this.tip('企业列表加载失败')}
},
async fetchProfilePool(){
if(this.profilePool.loading)return;
this.profilePool.loading=true;
try{
var page=1,pageSize=500,total=0,items=[];
while(true){
const r=await fetch('/api/v1/enterprises?page='+page+'&page_size='+pageSize);
if(!r.ok)break;
const d=await r.json();
total=d.total||0;
items=items.concat(d.items||[]);
if(!d.items||!d.items.length||items.length>=total)break;
page++;
if(page>50)break;
}
this.profilePool={items:items,total:total||items.length,loading:false};
}catch(e){
this.profilePool.loading=false;
}finally{
this.profilePool.loading=false;
}
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
async fetchHighRiskIndicators(){
try{const r=await fetch('/api/v1/indicators/high-risk');this.highRiskIndicators=await r.json();var self=this;this.$nextTick(function(){self.renderHighRiskChart()})}catch(e){}
},
async fetchAll(){var self=this;await Promise.all([this.fetchDash(),this.fetchEnhancedDash(),this.fetchEnts(),this.fetchProfilePool(),this.fetchRules(),this.fetchIndicators(),this.fetchIndicatorSummary(),this.fetchHighRiskIndicators()]);this.tip('数据加载完成');this.$nextTick(function(){if(self.tab==='dashboard'){self.renderAllDashboardCharts()}if(self.tab==='indicators'&&self.loggedIn){self.renderHighRiskChart()}})},
startAutoRefresh(){},
async exportData(level){
try{
const r=await fetch('/api/v1/enterprises/export'+(level?'?risk_level='+encodeURIComponent(level):''));
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
const r=await fetch('/api/v1/config/'+this.domainKey+'/'+rule.key,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...rule,threshold_t2:rule.threshold_t2||'',score_t2:rule.score_t2||null})});
if(r.ok)this.tip('指标「'+rule.name+'」保存成功');else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('保存失败')}
},
async deleteRule(key,name){
if(!confirm('确定删除指标「'+name+'」？'))return;
try{const r=await fetch('/api/v1/config/'+this.domainKey+'/'+key,{method:'DELETE'});if(r.ok){this.tip('已删除');this.fetchRules()}}catch(e){this.tip('删除失败')}
},
async addRule(){
if(!this.newRule.key||!this.newRule.name){this.tip('请填写标识和名称');return}
try{
const r=await fetch('/api/v1/config/'+this.domainKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...this.newRule,threshold_t2:this.newRule.threshold_t2||'',score_t2:this.newRule.score_t2||null})});
 if(r.ok){this.tip('新增成功');this.showAddRule=false;this.newRule={key:'',name:'',category:'',five_category:'',description:'',scoring_rule:'',field:'',operator:'>=',threshold:0,score:10,threshold_t2:'',score_t2:null,is_red_line:false,source:''};this.fetchRules()}
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
if(r.ok){this.tip('企业录入成功');this.showAddEnt=false;this.newEnt={name:'',credit_code:'',enterprise_type:'factory',district:'',industry:'',contact_person:'',contact_phone:'',employee_count:0};this.fetchEnts();this.fetchProfilePool();this.fetchDash()}
else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('录入失败')}
},
async delEnt(id,name){
if(!confirm('确定删除企业「'+name+'」？'))return;
try{const r=await fetch('/api/v1/enterprises/'+id,{method:'DELETE'});if(r.ok){this.tip('已删除');this.fetchEnts();this.fetchProfilePool();this.fetchDash()}}catch(e){this.tip('删除失败')}
},
onRegistryFileChange(e){this.registryFile=e.target.files[0];},
async doRegistryUpload(){if(!this.registryFile)return;this.registryUploading=true;this.registryResult=null;try{const form=new FormData();form.append('file',this.registryFile);const r=await fetch('/api/v1/enterprises/upload-registry',{method:'POST',body:form});if(r.ok){const d=await r.json();this.registryResult=d.message||'上传完成';this.fetchEnts();this.fetchProfilePool()}else{const d=await r.json();this.registryResult=d.detail||'上传失败'}}catch(e){this.registryResult='上传失败'}finally{this.registryUploading=false;this.registryFile=null}},
onUploadIndicatorFileChange(e){this.uploadIndicatorFile=e.target.files[0];},
async doUploadIndicators(){if(!this.uploadIndicatorFile)return;this.uploadIndicatorUploading=true;this.uploadIndicatorResult=null;try{const form=new FormData();form.append('file',this.uploadIndicatorFile);const r=await fetch('/api/v1/enterprises/upload-indicators',{method:'POST',body:form});if(r.ok){const d=await r.json();this.uploadIndicatorResult=d.message||'上传完成';this.fetchEnts();this.fetchProfilePool();this.fetchDash()}else{const d=await r.json();this.uploadIndicatorResult=d.detail||'上传失败'}}catch(e){this.uploadIndicatorResult='上传失败'}finally{this.uploadIndicatorUploading=false;this.uploadIndicatorFile=null}},
openAssess(ent){this.assessEnt=ent;this.assessData=JSON.stringify(ent.raw_data||{},null,2);this.showAssess=true},
clearBatchAnimationTimers(){
if(this.batchScrollTimer){clearInterval(this.batchScrollTimer);this.batchScrollTimer=null}
if(this.batchPhaseTimer){clearTimeout(this.batchPhaseTimer);this.batchPhaseTimer=null}
if(this.batchHideTimer){clearTimeout(this.batchHideTimer);this.batchHideTimer=null}
},
async doAssess(){
try{
const data=JSON.parse(this.assessData);
const r=await fetch('/api/v1/enterprises/'+this.assessEnt.id+'/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
if(r.ok){this.tip('评估完成');this.showAssess=false;this.fetchEnts();this.fetchProfilePool();this.fetchDash()}
else{const d=await r.json();this.tip(d.detail)}
}catch(e){this.tip('JSON格式错误或请求失败')}
},
async openProfile(eid,opts){
opts=opts||{};
try{
const r=await fetch('/api/v1/enterprises/'+eid+'/profile');
if(!r.ok){this.tip('加载画像失败');return}
this.profileData=await r.json();
this.profileEnterpriseId=String(eid);
this.expandedGroups={};
this.tab='profile';
if(!opts.skipRoute)this.navigateTo('profile',{enterpriseId:eid});
var self=this;this.$nextTick(function(){self.renderCharts()});
}catch(e){this.tip('加载画像失败')}
},
prevProfile(){
const list=this.psFilteredEnts;
const idx=list.findIndex(e=>String(e.id)===String(this.profileEnterpriseId));
if(idx>0)this.openProfile(list[idx-1].id);
},
nextProfile(){
const list=this.psFilteredEnts;
const idx=list.findIndex(e=>String(e.id)===String(this.profileEnterpriseId));
if(idx<list.length-1)this.openProfile(list[idx+1].id);
},
exportProfileReport(){
const d=this.profileData;if(!d||!d.enterprise)return;
const e=d.enterprise;
let rows='';
(e.risk_details||[]).forEach(r=>{
rows+='<tr><td>'+(r.category||'')+'</td><td>'+(r.item_name||'')+'</td><td style="color:red">+'+r.score+'分</td></tr>';
});
const html='<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>企业风险画像报告 - '+e.name+'</title><style>body{font-family:"Segoe UI",system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1c1917;background:#faf9f7}h1{margin:0 0 4px}h2{font-weight:400;color:#9e9b98;font-size:14px;margin:0 0 24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ece8e3;padding:8px 12px;text-align:left;font-size:14px}.badge{display:inline-block;padding:2px 12px;border-radius:10px;font-size:12px;color:#fff;background:#ef4444}.score{font-size:36px;font-weight:700}.meta{color:#6b6864;font-size:14px;margin:16px 0}.actions{background:rgba(249,115,22,.08);border-left:4px solid #f97316;padding:12px 16px;margin-top:20px;border-radius:4px}</style></head><body><h1>'+e.name+' <span class="badge">'+(e.risk_level||'未评估')+'</span></h1><h2>企业风险画像报告 · 生成时间 '+new Date().toLocaleString('zh-CN')+'</h2><div class="score">'+(e.risk_score>=0?e.risk_score:'—')+' <span style="font-size:16px;color:#9e9b98">分</span></div><div class="meta">信用代码：'+(e.credit_code||'—')+' | 类型：'+(e.enterprise_type==='factory'?'制造业/服务业':'工程建设')+' | 街道：'+(e.district||'—')+' | 评估时间：'+(e.last_assessed_at?e.last_assessed_at.substring(0,10):'—')+'</div><table><thead><tr><th>维度</th><th>指标项</th><th>扣分</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">无扣分项</td></tr>')+'</tbody></table><div class="actions"><strong>处置建议：</strong>'+(e.recommended_actions||'暂无建议')+'</div></body></html>';
const w=window.open('','_blank');
w.document.write(html);w.document.close();
},
riskLevelClass(l){
if(l==='红色预警')return'risk-red';
if(l==='黄色预警')return'risk-yellow';
if(l==='蓝色预警')return'risk-blue';
if(l==='绿色预警')return'risk-green';
return'';
},
renderCharts(){
if(!this.profileData)return;
const trendEl=document.getElementById('trendChart');
const radarEl=document.getElementById('radarChart');
if(trendEl){
const trendChart=echarts.init(trendEl);
let hist=this.profileData.history||[];
if(hist.length>6)hist=hist.slice(hist.length-6);
const dates=hist.map(function(h){return h.assessed_at.substring(5,10)});
const scores=hist.map(function(h){return h.risk_score});
trendChart.setOption({
tooltip:{trigger:'axis'},
grid:{left:40,right:20,top:30,bottom:30},
xAxis:{type:'category',data:dates.length?dates:['无历史']},
yAxis:{type:'value',min:0},
series:[{data:scores.length?scores:[0],type:'line',smooth:true,itemStyle:{color:'#00c3ff'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(0,195,255,0.5)'},{offset:1,color:'rgba(0,195,255,0)'}])}}]
});
}
if(radarEl){
const radarChart=echarts.init(radarEl);
const radar=this.profileData.radar||[];
const maxVal=Math.max(10,...radar.map(function(r){return r.value}))+10;
radarChart.setOption({
tooltip:{trigger:'item'},
radar:{
indicator:radar.length?radar.map(function(r){return {name:r.name,max:maxVal}}):[{name:'无配置',max:100}],
radius:'65%',
name:{textStyle:{color:this.isDark?'#aaa':'#666',fontSize:10}}
},
series:[{
type:'radar',
data:[{value:radar.map(function(r){return r.value}),name:'扣分分布',itemStyle:{color:'#ff4d4f'},areaStyle:{color:'rgba(255,77,79,0.3)'}}]
}]
});
}
},
async batchAssess(){
this.clearBatchAnimationTimers();
this.batchAssessing=true;
this.batchResult=null;
this.batchIndicatorQueue=[];
this.batchQueueIdx=0;
this.batchPhase='intro';
this.batchStatusText='AI人工智能大模型评估中';
var self=this;
if(!self.indicators||!self.indicators.length){try{var x=await fetch('/api/v1/indicators');self.indicators=await x.json()}catch(e){}}
var list=(self.indicators||[]).map(function(i){return i.name}).filter(Boolean);
if(!list.length)list=['企业基础信息核验','社保缴纳情况识别','工资支付异常识别','历史处置记录研判','红线规则命中检测','综合风险评分计算'];
var summarizeHoldDone=false;
var apiFinished=false;
var apiResult=null;
var apiError=null;
function maybeFinalize(){
if(apiFinished&&summarizeHoldDone)finalizeBatch();
}
function finalizeBatch(){
self.clearBatchAnimationTimers();
if(apiError){
self.batchPhase='error';
self.batchStatusText='评估失败：'+apiError;
self.batchHideTimer=setTimeout(function(){
self.batchAssessing=false;
self.batchPhase='';
self.batchStatusText='';
self.batchIndicatorQueue=[];
},3400);
return;
}
self.batchPhase='complete';
self.batchStatusText='评估完成 已评估 '+((apiResult&&apiResult.assessed)||0)+' 家企业';
self.batchResult=apiResult;
Promise.all([self.fetchEnts(),self.fetchProfilePool(),self.fetchDash()]).catch(function(){});
self.batchHideTimer=setTimeout(function(){
self.batchAssessing=false;
self.batchPhase='';
self.batchStatusText='';
self.batchIndicatorQueue=[];
},3200);
}
function moveToSummarizing(){
self.batchPhase='summarizing';
self.batchStatusText='正在汇总评估结果...';
self.batchPhaseTimer=setTimeout(function(){
summarizeHoldDone=true;
maybeFinalize();
},1500);
}
function moveToCalculating(){
self.batchPhase='calculating';
self.batchStatusText='正在计算风险评分...';
self.batchPhaseTimer=setTimeout(function(){moveToSummarizing()},1000);
}
self.batchPhaseTimer=setTimeout(function(){
self.batchPhase='scrolling';
self.batchStatusText='AI人工智能大模型评估中';
self.batchIndicatorQueue=list.slice();
self.batchQueueIdx=0;
self.batchScrollTimer=setInterval(function(){
if(self.batchQueueIdx>=list.length-1){
self.clearBatchAnimationTimers();
moveToCalculating();
return;
}
self.batchQueueIdx++;
},230);
},400);
try{
const r=await fetch('/api/v1/enterprises/batch-assess',{method:'POST'});
const d=await r.json();
if(!r.ok)throw new Error(d.detail||d.message||'批量评估失败');
apiFinished=true;
apiResult=d;
maybeFinalize();
}catch(e){
apiFinished=true;
apiError=e.message;
maybeFinalize();
}
},
toggleExpand(id){this.expandedId=this.expandedId===id?null:id},
changeLevel(lvl){this.levelFilter=lvl;this.entPage=1;this.fetchEnts()},
toggleViewMode(mode){this.entViewMode=mode;},

// ── Dashboard Charts ──
renderAllDashboardCharts(){
var self=this;
self.$nextTick(function(){
self.renderRiskDonut();
self.renderTrendLineChart();
self.renderDashboardDistrictChart();
self.renderDashboardMap();
});
},
renderRiskDonut(){
var el=document.getElementById('riskDonutChart');
if(!el)return;
if(this.riskDonutChart)this.riskDonutChart.dispose();
this.riskDonutChart=echarts.init(el);
var total=this.dash.total||0;
var assessed=(this.dash.red||0)+(this.dash.yellow||0)+(this.dash.blue||0)+(this.dash.green||0);
var chartData=[
{value:this.dash.red,name:'红色预警',itemStyle:{color:'#c64545'}},
{value:this.dash.yellow,name:'黄色预警',itemStyle:{color:'#d4a017'}},
{value:this.dash.blue,name:'蓝色预警',itemStyle:{color:'#5db8a6'}},
{value:this.dash.green,name:'绿色预警',itemStyle:{color:'#5db872'}}
];
var self=this;
this.riskDonutChart.off('click');
this.riskDonutChart.on('click',function(params){
if(params.name){self.donutActiveLevel=self.donutActiveLevel===params.name?null:params.name;}
});
this.riskDonutChart.setOption({

graphic:[
{type:'text',left:'center',top:'38%',style:{text:'已评估企业',fill:'#6c6a64',fontSize:12,fontWeight:500,textAlign:'center'}},
{type:'text',left:'center',top:'45%',style:{text:String(assessed),fill:'#141413',fontSize:28,fontWeight:600,textAlign:'center'}},

],
series:[{type:'pie',radius:['52%','74%'],center:['50%','50%'],avoidLabelOverlap:true,startAngle:115,minAngle:4,
label:{show:true,position:'outside',formatter:function(p){return p.value+'家 '+p.percent+'%'},fontSize:10,color:'#3d3d3a',fontWeight:500},
labelLine:{length:14,length2:10,smooth:true,lineStyle:{color:'#d8d0c5',width:1}},
emphasis:{scale:true,scaleSize:6,label:{show:true,fontSize:13,fontWeight:'600',color:'#141413'}},
itemStyle:{borderRadius:8,borderColor:'#faf9f5',borderWidth:3,shadowBlur:10,shadowColor:'rgba(20,20,19,0.06)'},
data:chartData
}]
});
},
renderTrendLineChart(){
var el=document.getElementById('trendLineChart');
if(!el)return;
if(this.trendLineChart)this.trendLineChart.dispose();
this.trendLineChart=echarts.init(el);
var trend=this.enhancedDash.trend||[];
var months=trend.map(function(d){return d.month});
this.trendLineChart.setOption({
tooltip:{trigger:'axis'},
grid:{left:42,right:14,top:18,bottom:24},
xAxis:{type:'category',data:months.length?months:['暂无'],axisLabel:{fontSize:10}},
yAxis:{type:'value',minInterval:1},
series:[
{name:'红色',type:'line',data:trend.map(function(d){return d.red}),lineStyle:{color:'#c0392b',width:2},itemStyle:{color:'#c0392b'},smooth:true},

{name:'黄色',type:'line',data:trend.map(function(d){return d.yellow}),lineStyle:{color:'#b8860b',width:2},itemStyle:{color:'#b8860b'},smooth:true},{name:'绿色',type:'line',data:trend.map(function(d){return d.green||0}),lineStyle:{color:'#2d8659',width:2},itemStyle:{color:'#2d8659'},smooth:true},
{name:'蓝色',type:'line',data:trend.map(function(d){return d.blue}),lineStyle:{color:'#3b7a9e',width:2},itemStyle:{color:'#3b7a9e'},smooth:true}
]});
},
renderDashboardDistrictChart(){
var el=document.getElementById('dashboardDistrictChart');
if(!el)return;
if(this.dashboardDistrictChart)this.dashboardDistrictChart.dispose();
this.dashboardDistrictChart=echarts.init(el);
var districts=this.enhancedDash.districts||[];
var rows=districts.map(function(d){
return {name:d.district,red:d.red||0,yellow:d.yellow||0,blue:d.blue||0,green:d.green||0,total:(d.red||0)+(d.yellow||0)+(d.blue||0)+(d.green||0)};
}).sort(function(a,b){return b.total-a.total});
var names=rows.map(function(d){return d.name});
var totals=rows.map(function(d){return d.total});
this.dashboardDistrictChart.setOption({
tooltip:{trigger:'axis',axisPointer:{type:'shadow'},backgroundColor:'#fff',borderColor:'#e6dfd8',textStyle:{color:'#141413',fontSize:12},formatter:function(p){var html=p[0].name+'<br/>';var t=0;p.forEach(function(i){html+=i.marker+' '+i.seriesName+': '+i.value+'家<br/>';t+=i.value});html+='<hr style="margin:4px 0;border-color:#e6dfd8"/><strong>合计: '+t+'家</strong>';return html}},

grid:{left:18,right:50,top:10,bottom:4,containLabel:true},
xAxis:{type:'value',minInterval:1,splitNumber:4,axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:'#ebe6df',type:'dashed'}},axisLabel:{color:'#8e8b82',fontSize:10}},
yAxis:{type:'category',data:names.length?names:['暂无'],axisLine:{show:false},axisTick:{show:false},axisLabel:{fontSize:13,color:'#3d3d3a',width:80,overflow:'truncate'}},
series:[
{name:'红色预警',type:'bar',stack:'total',barWidth:18,data:rows.map(function(d){return d.red}),itemStyle:{color:'#c64545',borderRadius:[8,0,0,8],borderColor:'#faf9f5',borderWidth:1}},
{name:'黄色预警',type:'bar',stack:'total',barWidth:18,data:rows.map(function(d){return d.yellow}),itemStyle:{color:'#d4a017',borderColor:'#faf9f5',borderWidth:1}},
{name:'蓝色预警',type:'bar',stack:'total',barWidth:18,data:rows.map(function(d){return d.blue}),itemStyle:{color:'#5db8a6',borderColor:'#faf9f5',borderWidth:1}},
{name:'绿色预警',type:'bar',stack:'total',barWidth:18,data:rows.map(function(d){return d.green}),itemStyle:{color:'#5db872',borderRadius:[0,8,8,0],borderColor:'#faf9f5',borderWidth:1},
label:{show:true,position:'right',distance:8,color:'#6c6a64',fontSize:12,fontWeight:500,formatter:function(p){return totals[p.dataIndex]+'家'}}}
]});
},
renderDashboardMap(){
var el=document.getElementById('dashboardMap');
if(!el)return;
this.mountStreetRiskMap(el,'dashboardMapObj','dashboardMapCluster');
},

// ── High Risk Chart ──
renderHighRiskChart(){
var el=document.getElementById('highRiskChart');
if(!el)return;
if(this.highRiskChartObj)this.highRiskChartObj.dispose();
this.highRiskChartObj=echarts.init(el);
var sorted=this.highRiskIndicators.slice().sort(function(a,b){return b.triggered_count-a.triggered_count}).slice(0,10);
var names=sorted.map(function(d){return d.name});
var counts=sorted.map(function(d){return d.triggered_count});
var maxC=Math.max.apply(null,counts.length?counts:[1]);
this.highRiskChartObj.setOption({
tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(p){return p[0].name+'<br/>触发: '+p[0].value+'次'}},
grid:{left:210,right:50,top:8,bottom:10},
xAxis:{show:false,type:'value',min:0,max:Math.max(maxC*1.25,50)},
yAxis:{type:'category',data:names.length?names:[],inverse:true,
axisLine:{show:false},axisTick:{show:false},
axisLabel:{fontSize:12,color:'#141413',fontWeight:500,
width:180,overflow:'truncate',padding:[0,4,0,0]}},
series:[{type:'bar',barWidth:14,barGap:14,roundCap:true,
showBackground:true,
backgroundStyle:{color:'#efe9de',borderRadius:7},
data:counts.length?counts.map(function(v){return{value:v,itemStyle:{color:'#cc785c',borderRadius:7}}}):[],
label:{show:true,position:'right',fontSize:13,fontWeight:500,color:'#6c6a64',formatter:'{c}'}}
]});
},

// ── Export ──
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
async exportCategory(cat){
try{
this.tip('正在导出…');
const r=await fetch('/api/v1/enterprises/export/by-category?category='+encodeURIComponent(cat));
if(!r.ok){this.tip('导出失败');return}
const blob=await r.blob();
const url=URL.createObjectURL(blob);
const a=document.createElement('a');
a.href=url;
a.download='wage_arrears_category.xlsx';
document.body.appendChild(a);a.click();
document.body.removeChild(a);URL.revokeObjectURL(url);
this.tip('导出成功')
}catch(e){this.tip('导出失败: '+e.message)}
},

// ── Sorting ──
sortEnts(field){
if(this.sortField===field){this.sortDir=this.sortDir==='asc'?'desc':'asc'}
else{this.sortField=field;this.sortDir='asc'}
},

// ── Big Screen ──
openBigScreen(){
this.bigscreen.active=true;this.bigscreen.view=0;this.bsChartRendered=false;
document.body.style.overflow='hidden';
var self=this;
self.$nextTick(function(){self.renderBigScreenCharts()});
if(this.bigscreen.timer)clearInterval(this.bigscreen.timer);
this.bigscreen.timer=setInterval(function(){self.nextView()},15000);
},
closeBigScreen(){
this.bigscreen.active=false;document.body.style.overflow='';
if(this.bigscreen.timer){clearInterval(this.bigscreen.timer);this.bigscreen.timer=null}
if(this.bsTrendChart){this.bsTrendChart.dispose();this.bsTrendChart=null}
if(this.bsDistrictChart){this.bsDistrictChart.dispose();this.bsDistrictChart=null}
this.disposeAmapMap('bsMap','bsCluster');
this.bsChartRendered=false;
},
prevView(){this.bigscreen.view=(this.bigscreen.view-1+this.bigscreen.views)%this.bigscreen.views;var self=this;self.$nextTick(function(){self.renderBigScreenCharts()})},
nextView(){this.bigscreen.view=(this.bigscreen.view+1)%this.bigscreen.views;var self=this;self.$nextTick(function(){self.renderBigScreenCharts()})},
renderBigScreenCharts(){
if(this.bigscreen.view===1)this.renderBsTrendChart();
else if(this.bigscreen.view===2)this.renderBsMap();
else if(this.bigscreen.view===3)this.renderBsDistrictChart();
},
renderBsTrendChart(){
var el=document.getElementById('bsTrendChart');
if(!el)return;
if(this.bsTrendChart)this.bsTrendChart.dispose();
this.bsTrendChart=echarts.init(el);
var dates=[];var scores=[];
if(this.enterprises.items&&this.enterprises.items.length){
var sorted=this.enterprises.items.filter(function(e){return e.last_assessed_at}).sort(function(a,b){return a.last_assessed_at.localeCompare(b.last_assessed_at)});
var recent=sorted.slice(-8);
dates=recent.map(function(e){return e.last_assessed_at.substring(5,10)});
scores=recent.map(function(e){return e.risk_score||0});
}
this.bsTrendChart.setOption({
tooltip:{trigger:'axis'},
grid:{left:50,right:30,top:40,bottom:40},
xAxis:{type:'category',data:dates.length?dates:['暂无'],axisLabel:{color:'#aaa',fontSize:12}},
yAxis:{type:'value',min:0,axisLabel:{color:'#aaa'}},
series:[{data:scores.length?scores:[0],type:'line',smooth:true,lineStyle:{color:'#00c3ff',width:3},itemStyle:{color:'#00c3ff'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(0,195,255,0.4)'},{offset:1,color:'rgba(0,195,255,0)'}])}}]
});
},
renderBsDistrictChart(){
var el=document.getElementById('bsDistrictChart');
if(!el)return;
if(this.bsDistrictChart)this.bsDistrictChart.dispose();
this.bsDistrictChart=echarts.init(el);
var distMap={};
(this.enterprises.items||[]).forEach(function(e){
var d=e.district||'未知';
if(!distMap[d])distMap[d]={total:0,red:0,green:0};
distMap[d].total++;
if(e.risk_level==='红色预警')distMap[d].red++;
		else if(e.risk_level==='绿色预警')distMap[d].green++;
});
var districts=Object.keys(distMap).sort();
this.bsDistrictChart.setOption({
tooltip:{trigger:'axis'},
legend:{data:['红色预警','绿色预警','其他'],textStyle:{color:'#aaa'},top:5},
grid:{left:50,right:30,top:50,bottom:60},
xAxis:{type:'category',data:districts.length?districts:['暂无'],axisLabel:{color:'#aaa',rotate:districts.length>6?30:0,fontSize:11}},
yAxis:{type:'value',axisLabel:{color:'#aaa'}},
series:[
{name:'红色预警',type:'bar',stack:'total',data:districts.map(function(d){return distMap[d].red}),itemStyle:{color:'#c0392b'}},
	{name:'绿色预警',type:'bar',stack:'total',data:districts.map(function(d){return distMap[d].green||0}),itemStyle:{color:'#2d8659'}},
{name:'其他',type:'bar',stack:'total',data:districts.map(function(d){return distMap[d].total-distMap[d].red}),itemStyle:{color:'#64748b'}}
]
});
},
renderBsMap(){
var el=document.getElementById('bsMapContainer');
if(!el)return;
this.mountStreetRiskMap(el,'bsMap','bsCluster');
},

// ── Indicator detail expand ──
toggleExpandInd(key){this.expandedIndId=this.expandedIndId===key?null:key},
toggleExpandCat(key){this.expandedIndCatId=this.expandedIndCatId===key?null:key}
},
mounted(){
document.body.classList.add("light");
this.loggedIn=sessionStorage.getItem("wage_admin_logged")==="1";
var self=this;
window.addEventListener('hashchange',function(){self.applyRoute(self.parseRoute())});
if(!window.location.hash)window.location.hash=this.buildRoute('dashboard');
this.fetchDash();
this.fetchEnhancedDash();
this.fetchEnts();
this.fetchProfilePool();
if(this.loggedIn){this.fetchRules();this.fetchIndicators();this.fetchIndicatorSummary();this.fetchHighRiskIndicators()}
this.startAutoRefresh();
this.applyRoute(this.parseRoute());
this.$nextTick(function(){setTimeout(function(){if(self.tab==='dashboard'){self.renderAllDashboardCharts()}},800)});
}
}).mount("#app");
