const{createApp}=Vue;
createApp({
data(){return{
tab:'dashboard',
dash:{total:0,assessed:0,unassessed:0,red:0,yellow:0,blue:0,green:0,red_line_count:0,top_risk:[]},
enterprises:{total:0,items:[]},
entSearch:'',entTypeFilter:'',levelFilter:'all',
indicators:[],indicatorSummary:{domain_summary:[],type_summary:{}},indDomainFilter:'',
showLogin:false,loginUser:'',loginPwd:'',loginErr:'',
toast:{vis:false,msg:''},
}},
computed:{
filteredEnts(){
let list=this.enterprises.items||[];
if(this.levelFilter!=='all')list=list.filter(function(e){return e.risk_level===this.levelFilter}.bind(this));
return list;
},
levelCounts(){
var items=this.enterprises.items||[];
return{
red:items.filter(function(e){return e.risk_level==='红色预警'}).length,
yellow:items.filter(function(e){return e.risk_level==='黄色预警'}).length,
blue:items.filter(function(e){return e.risk_level==='蓝色预警'}).length,
	green:items.filter(function(e){return e.risk_level==='绿色预警'}).length
};
},
filteredIndicators(){
if(!this.indDomainFilter)return this.indicators;
return this.indicators.filter(function(i){return i.domain===this.indDomainFilter}.bind(this));
}
},
methods:{
tip(m){this.toast.msg=m;this.toast.vis=true;setTimeout(function(){this.toast.vis=false}.bind(this),3000)},
badgeClass(l){if(l==='红色预警')return'badge-red';if(l==='绿色预警')return'badge-green';if(l==='黄色预警')return'badge-yellow';if(l==='蓝色预警')return'badge-blue';return'badge-gray'},
async fetchDash(){
try{var r=await fetch('/api/v1/dashboard/summary');this.dash=await r.json()}catch(e){this.tip('仪表盘加载失败')}
},
async fetchEnts(){
try{
var url='/api/v1/enterprises?page=1&page_size=200';
if(this.entSearch)url+='&search='+encodeURIComponent(this.entSearch);
if(this.entTypeFilter)url+='&enterprise_type='+this.entTypeFilter;
var r=await fetch(url);this.enterprises=await r.json()
}catch(e){this.tip('企业列表加载失败')}
},
async fetchIndicators(){
try{var r=await fetch('/api/v1/indicators');this.indicators=await r.json()}catch(e){this.tip('指标数据加载失败')}
},
async fetchIndicatorSummary(){
try{var r=await fetch('/api/v1/indicators/summary');this.indicatorSummary=await r.json()}catch(e){this.tip('指标汇总加载失败')}
},
async fetchAll(){await Promise.all([this.fetchDash(),this.fetchEnts(),this.fetchIndicators(),this.fetchIndicatorSummary()]);this.tip('数据加载完成')},
doLogin(){
if(this.loginUser!=='ufo6110225'){this.loginErr='账号错误';return}
if(this.loginPwd!=='a6110225'){this.loginErr='密码错误';return}
this.loginErr='';
window.location.href='index.html';
}
},
watch:{
entSearch:function(){this.fetchEnts()},
entTypeFilter:function(){this.fetchEnts()}
},
mounted(){this.fetchAll()}
}).mount('#app');
