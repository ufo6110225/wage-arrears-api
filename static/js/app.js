const { createApp } = Vue;

createApp({
  data() { return {
    tab: 'dashboard',
    drawerOpen: false,

    // Auth
    showLogin: false,
    loggedIn: !!localStorage.getItem('wa_logged_in'),
    loginForm: { username: '', password: '' },
    loginError: '',
    loginLoading: false,

    // Dashboard
    dash: { total: 0, assessed: 0, unassessed: 0, red: 0, yellow: 0, blue: 0, green: 0, red_line_count: 0, top_risk: [] },
    enhanced: { trend: [], district_stats: [], recent_assessments: [], top_redlines: [] },

    // Enterprises
    enterprises: { total: 0, items: [] },
    entSearch: '',
    entTypeFilter: '',
    entDistrictFilter: '',
    entPage: 1,
    levelFilter: 'all',
    showAddEnt: false,
    newEnt: { name: '', credit_code: '', enterprise_type: 'factory', district: '', industry: '', contact_person: '', contact_phone: '', employee_count: 0 },
    showAssess: false,
    assessEnt: null,
    assessData: '{}',
    expandedId: null,
    showProfile: false,
    profileData: null,

    // Rules
    commonRules: [], factoryRules: [], constructionRules: [],
    commonName: '通用基础', factoryName: '制造业/服务业', constructionName: '工程建设',
    showAddRule: false,
    newRule: { key: '', name: '', category: '', description: '', field: '', operator: '>=', threshold: 0, score: 10, is_red_line: false },

    // Indicators
    indicators: [],
    indicatorSummary: { domain_summary: [], type_summary: {} },
    indDomainFilter: '',
    expandedIndId: null,
    highRiskIndicators: [],

    // System
    sysConfig: {},
    sysLabels: { api_host: '服务绑定地址', api_port: '服务端口号', api_title: 'API文档标题', debug_mode: '调试模式', risk_red_threshold: '红色预警阈值(%)', risk_yellow_threshold: '黄色预警阈值(%)', risk_blue_threshold: '蓝色预警阈值(%)' },

    // Toast
    toast: { vis: false, msg: '' },

    // Big screen
    bigscreen: { active: false, view: 0, views: 5, timer: null },

    // Report
    showReport: false,
    reportConfig: { title: '宝安区欠薪预警分析报告', timeRange: 'monthly', includeTrend: true, includeDistricts: true, includeTopRisk: true, includeMap: false },
  } },

  computed: {
    rules() {
      if (this.tab === 'ruleCommon') return this.commonRules;
      if (this.tab === 'ruleFactory') return this.factoryRules;
      return this.constructionRules;
    },
    domainKey() {
      if (this.tab === 'ruleCommon') return 'common';
      if (this.tab === 'ruleFactory') return 'factory';
      return 'construction';
    },
    domainName() {
      if (this.tab === 'ruleCommon') return this.commonName;
      if (this.tab === 'ruleFactory') return this.factoryName;
      return this.constructionName;
    },
    filteredEnts() {
      let list = this.enterprises.items || [];
      if (this.levelFilter !== 'all') list = list.filter(e => e.risk_level === this.levelFilter);
      return list;
    },
    levelCounts() {
      const items = this.enterprises.items || [];
      return {
        all: items.length,
        red: items.filter(e => e.risk_level === '红色预警').length,
        yellow: items.filter(e => e.risk_level === '黄色预警').length,
        blue: items.filter(e => e.risk_level === '蓝色预警').length,
        green: items.filter(e => e.risk_level === '绿色预警').length
      };
    },
    filteredIndicators() {
      if (!this.indDomainFilter) return this.indicators;
      return this.indicators.filter(i => i.domain === this.indDomainFilter);
    },
    indicatorCategories() {
      const map = {};
      for (const ind of this.indicators) {
        const key = ind.category || '未分类';
        if (!map[key]) {
          map[key] = { name: key, domain: ind.domain, indicator_count: 0, triggered_count: 0, total_score: 0, red_line_count: 0, indicators: [] };
        }
        map[key].indicator_count++;
        map[key].total_score += ind.score || 0;
        map[key].triggered_count = Math.max(map[key].triggered_count, ind.triggered_count || 0);
        if (ind.is_red_line) map[key].red_line_count++;
        map[key].indicators.push(ind);
      }
      return Object.values(map).sort((a, b) => b.total_score - a.total_score);
    },
    trendChange() {
      const t = this.enhanced.trend || [];
      if (t.length < 2) return { red: 0, yellow: 0, blue: 0, green: 0 };
      const last = t[t.length - 1];
      const prev = t[t.length - 2];
      return {
        red: last.red - prev.red,
        yellow: last.yellow - prev.yellow,
        blue: last.blue - prev.blue,
        green: last.green - prev.green
      };
    },
    districtList() {
      if (!this.enhanced.district_stats) return [];
      return this.enhanced.district_stats.map(d => d.district).filter(Boolean);
    }
  },

  watch: {
    tab(val) {
      if (val === 'indicators') { this.fetchIndicators(); this.fetchIndicatorSummary(); }
      if (val === 'ruleCommon') this.fetchRules('common');
      if (val === 'ruleFactory') this.fetchRules('factory');
      if (val === 'ruleConstruction') this.fetchRules('construction');
      if (val === 'system') this.fetchSys();
    },
    'dash.total'(val) {
      if (val > 0) this.$nextTick(() => { this.renderRiskDonut(); this.renderMap(); });
    }
  },

  methods: {
    // ── Utility ──
    tip(m) { this.toast.msg = m; this.toast.vis = true; setTimeout(() => this.toast.vis = false, 3000); },
    badgeClass(l) {
      if (l === '红色预警') return 'badge-red';
      if (l === '黄色预警') return 'badge-yellow';
      if (l === '蓝色预警') return 'badge-blue';
      if (l === '绿色预警') return 'badge-green';
      return 'badge-gray';
    },
    labelTables() {
      if (window.innerWidth > 768) return;
      document.querySelectorAll('table').forEach(t => {
        const hdrs = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
        if (!hdrs.length) return;
        t.querySelectorAll('tbody tr').forEach(tr => {
          tr.querySelectorAll('td').forEach((td, i) => {
            if (hdrs[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', hdrs[i]);
          });
        });
      });
    },
    toggleExpand(id) { this.expandedId = this.expandedId === id ? null : id; },

    // ── Auth ──
    async doLogin() {
      this.loginLoading = true;
      this.loginError = '';
      try {
        const r = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.loginForm)
        });
        if (!r.ok) { this.loginError = '用户名或密码错误'; return; }
        const d = await r.json();
        if (d.status === 'success') {
          this.loggedIn = true;
          this.showLogin = false;
          localStorage.setItem('wa_logged_in', 'true');
          this.tip('登录成功');
          this.fetchAll();
        }
      } catch (e) { this.loginError = '登录失败，请检查网络连接'; }
      finally { this.loginLoading = false; }
    },
    logout() {
      this.loggedIn = false;
      localStorage.removeItem('wa_logged_in');
      this.tip('已退出管理');
    },

    // ── Dashboard Data ──
    async fetchDash() {
      try { const r = await fetch('/api/v1/dashboard/summary'); if (r.ok) this.dash = await r.json(); } catch (e) {}
    },
    async fetchEnhancedDash() {
      try {
        const r = await fetch('/api/v1/dashboard/enhanced');
        if (r.ok) {
          this.enhanced = await r.json();
          this.$nextTick(() => this.renderAllCharts());
        }
      } catch (e) {}
    },

    // ── Enterprises ──
    async fetchEnts() {
      try {
        const params = new URLSearchParams({ page: 1, page_size: 200 });
        if (this.entSearch) params.set('search', this.entSearch);
        if (this.entTypeFilter) params.set('enterprise_type', this.entTypeFilter);
        if (this.entDistrictFilter) params.set('district', this.entDistrictFilter);
        const r = await fetch('/api/v1/enterprises?' + params.toString());
        if (r.ok) this.enterprises = await r.json();
      } catch (e) {}
    },
    async addEnt() {
      try {
        const r = await fetch('/api/v1/enterprises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.newEnt)
        });
        if (r.ok) { this.showAddEnt = false; this.tip('企业录入成功'); this.fetchEnts(); }
        else { const d = await r.json(); this.tip(d.detail || '录入失败'); }
      } catch (e) { this.tip('录入失败'); }
    },
    async delEnt(id, name) {
      if (!confirm(`确定删除企业「${name}」？`)) return;
      try {
        const r = await fetch('/api/v1/enterprises/' + id, { method: 'DELETE' });
        if (r.ok) { this.tip('企业已删除'); this.fetchEnts(); }
      } catch (e) { this.tip('删除失败'); }
    },
    openAssess(ent) {
      this.assessEnt = ent;
      this.assessData = JSON.stringify(ent.raw_data || {}, null, 2);
      this.showAssess = true;
    },
    async doAssess() {
      try {
        const data = JSON.parse(this.assessData);
        const r = await fetch('/api/v1/enterprises/' + this.assessEnt.id + '/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (r.ok) { this.showAssess = false; this.tip('评估完成'); this.fetchEnts(); }
      } catch (e) { this.tip('评估失败'); }
    },
    async openProfile(id) {
      try {
        const r = await fetch('/api/v1/enterprises/' + id + '/profile');
        if (r.ok) { this.profileData = await r.json(); this.showProfile = true; this.$nextTick(() => this.renderCharts()); }
      } catch (e) { this.tip('加载画像失败'); }
    },
    renderCharts() {
      const pd = this.profileData;
      if (!pd) return;
      // Trend chart
      const trendEl = document.getElementById('trendChart');
      if (trendEl && pd.history && pd.history.length) {
        const chart = echarts.init(trendEl);
        const h = pd.history;
        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { left: 35, right: 10, top: 10, bottom: 25 },
          xAxis: { type: 'category', data: h.map(i => i.assessed_at ? i.assessed_at.substring(5, 16) : ''), axisLabel: { fontSize: 10 } },
          yAxis: { type: 'value', minInterval: 1 },
          series: [{
            type: 'line', smooth: true, data: h.map(i => i.risk_score),
            itemStyle: { color: '#cc785c' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(204,120,92,0.3)' }, { offset: 1, color: 'rgba(204,120,92,0)' }] } }
          }]
        });
      }
      // Radar chart
      const radarEl = document.getElementById('radarChart');
      if (radarEl && pd.radar && pd.radar.length) {
        const chart = echarts.init(radarEl);
        const maxVal = Math.max(...pd.radar.map(r => r.value), 10);
        chart.setOption({
          tooltip: {},
          radar: { indicator: pd.radar.map(r => ({ name: r.name, max: maxVal })), radius: '65%' },
          series: [{ type: 'radar', data: [{ value: pd.radar.map(r => r.value), name: '风险得分', areaStyle: { color: 'rgba(204,120,92,0.2)' }, lineStyle: { color: '#cc785c' }, itemStyle: { color: '#cc785c' } }] }]
        });
      }
    },
    async batchAssess() {
      try {
        const r = await fetch('/api/v1/enterprises/batch-assess', { method: 'POST' });
        if (r.ok) { const d = await r.json(); this.tip(d.message || '批量评估完成'); this.fetchEnts(); }
      } catch (e) { this.tip('批量评估失败'); }
    },
    async exportData(level) {
      const params = level ? '?risk_level=' + encodeURIComponent(level) : '';
      window.open('/api/v1/enterprises/export' + params, '_blank');
    },
    async exportIndicators() { window.open('/api/v1/indicators/export', '_blank'); },

    // ── Rules ──
    async fetchRules(domain) {
      try {
        const r = await fetch('/api/v1/config/' + domain);
        if (r.ok) {
          const d = await r.json();
          const rules = d.rules || [];
          // add _expanded for UI
          rules.forEach(r2 => { if (r2._expanded === undefined) r2._expanded = false; });
          if (domain === 'common') { this.commonRules = rules; this.commonName = d.name || '通用基础'; }
          else if (domain === 'factory') { this.factoryRules = rules; this.factoryName = d.name || '制造业/服务业'; }
          else { this.constructionRules = rules; this.constructionName = d.name || '工程建设'; }
        }
      } catch (e) { this.tip('规则加载失败'); }
    },
    async saveRule(rule) {
      try {
        const r = await fetch('/api/v1/config/' + this.domainKey + '/' + rule.key, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: rule.key, name: rule.name, category: rule.category, description: rule.description,
            field: rule.field, operator: rule.operator, threshold: rule.threshold, score: rule.score,
            is_red_line: rule.is_red_line
          })
        });
        if (r.ok) this.tip('指标更新成功');
        else { const d = await r.json(); this.tip(d.detail || '更新失败'); }
      } catch (e) { this.tip('保存失败'); }
    },
    async deleteRule(key, name) {
      if (!confirm(`确定删除指标「${name}」？`)) return;
      try {
        const r = await fetch('/api/v1/config/' + this.domainKey + '/' + key, { method: 'DELETE' });
        if (r.ok) { this.tip('指标已删除'); this.fetchRules(this.domainKey); }
      } catch (e) { this.tip('删除失败'); }
    },
    async addRule() {
      try {
        const r = await fetch('/api/v1/config/' + this.domainKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.newRule)
        });
        if (r.ok) { this.showAddRule = false; this.tip('指标新增成功'); this.fetchRules(this.domainKey); }
        else { const d = await r.json(); this.tip(d.detail || '新增失败'); }
      } catch (e) { this.tip('新增失败'); }
    },

    // ── System ──
    async fetchSys() {
      try { const r = await fetch('/api/v1/config/system'); if (r.ok) this.sysConfig = await r.json(); } catch (e) {}
    },
    async saveSys() {
      try {
        const r = await fetch('/api/v1/config/system', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.sysConfig)
        });
        if (r.ok) { this.tip('系统配置已保存'); }
      } catch (e) { this.tip('保存失败'); }
    },

    // ── Indicators ──
    async fetchIndicators() {
      try { const r = await fetch('/api/v1/indicators'); if (r.ok) this.indicators = await r.json(); } catch (e) {}
    },
    async fetchIndicatorSummary() {
      try { const r = await fetch('/api/v1/indicators/summary'); if (r.ok) this.indicatorSummary = await r.json(); } catch (e) {}
    },
    async fetchHighRiskIndicators() {
      // This endpoint isn't in the API; reuse indicators sorted by triggered_count
      const sorted = [...this.indicators].filter(i => i.triggered_count > 0).sort((a, b) => b.triggered_count - a.triggered_count);
      this.highRiskIndicators = sorted;
      this.$nextTick(() => this.renderHighRiskChart());
    },
    renderHighRiskChart() {
      const el = document.getElementById('highRiskChart');
      if (!el || !this.highRiskIndicators || !this.highRiskIndicators.length) return;
      const chart = echarts.init(el);
      const data = this.highRiskIndicators.slice(0, 15);
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 120, right: 40, top: 20, bottom: 20 },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: data.map(i => i.name).reverse(), axisLabel: { width: 100, overflow: 'truncate' } },
        series: [{
          type: 'bar', data: data.map(i => ({
            value: i.triggered_count,
            itemStyle: { color: i.is_red_line ? '#c64545' : '#e8a55a' }
          })).reverse(),
          label: { show: true, position: 'right' }
        }]
      });
    },

    // ── Dashboard Charts ──
    renderAllCharts() {
      this.renderEnhancedCharts();
      this.renderRiskDonut();
      this.renderMap();
      this.renderDistrictChart();
    },
    renderEnhancedCharts() {
      const el = document.getElementById('enhancedTrendChart');
      if (!el || !this.enhanced.trend || !this.enhanced.trend.length) return;
      const chart = echarts.init(el);
      const processedData = this.enhanced.trend.map(t => {
        const now = new Date(); const cm = now.toISOString().slice(0, 7);
        if (t.month === cm) return { month: t.month, red: t.red, yellow: t.yellow, blue: t.blue, green: t.green };
        const c = t.count || 1;
        return { month: t.month, red: Math.round(t.red / c), yellow: Math.round(t.yellow / c), blue: Math.round(t.blue / c), green: Math.round(t.green / c) };
      });
      const months = processedData.map(t => t.month.substring(5, 7) + '月');
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['红色', '黄色', '蓝色', '绿色'], bottom: 4, textStyle: { fontSize: 11 } },
        grid: { left: 50, right: 24, top: 28, bottom: 40 },
        xAxis: { type: 'category', data: months },
        yAxis: { type: 'value', minInterval: 1 },
        series: [
          { name: '红色', type: 'line', data: processedData.map(t => t.red), itemStyle: { color: '#ff4d4f' }, smooth: true },
          { name: '黄色', type: 'line', data: processedData.map(t => t.yellow), itemStyle: { color: '#d4a017' }, smooth: true },
          { name: '蓝色', type: 'line', data: processedData.map(t => t.blue), itemStyle: { color: '#1890ff' }, smooth: true },
          { name: '绿色', type: 'line', data: processedData.map(t => t.green), itemStyle: { color: '#52c41a' }, smooth: true }
        ]
      });
    },
    renderRiskDonut() {
      const el = document.getElementById('riskDonutChart');
      if (!el || !this.dash.total) return;
      const chart = echarts.init(el);
      chart.setOption({
        title: { text: '风险等级分布', left: 'center', top: 8, textStyle: { fontSize: 13, fontWeight: 500, color: '#6c6a64' } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [{
          name: '风险等级分布', type: 'pie', radius: ['40%', '65%'], center: ['50%', '58%'],
          avoidLabelOverlap: false, itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false }, emphasis: { label: { show: true } },
          data: [
            { value: this.dash.red, name: '红色预警', itemStyle: { color: '#ea3e3e' } },
            { value: this.dash.yellow, name: '黄色预警', itemStyle: { color: '#f5a623' } },
            { value: this.dash.blue, name: '蓝色预警', itemStyle: { color: '#4096ff' } },
            { value: this.dash.green, name: '绿色预警', itemStyle: { color: '#22c55e' } }
          ]
        }]
      });
    },
    renderDistrictChart() {
      const el = document.getElementById('districtChart');
      if (!el || !this.enhanced.district_stats || !this.enhanced.district_stats.length) return;
      const chart = echarts.init(el);
      const d = this.enhanced.district_stats;
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['红', '黄', '蓝', '绿'], bottom: 0 },
        grid: { left: 120, right: 20, top: 10, bottom: 30 },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: d.map(x => x.district).reverse(), inverse: true, axisLabel: { width: 60, overflow: 'truncate' } },
        series: [
          { name: '红', type: 'bar', stack: 'x', data: d.map(x => x.red).reverse(), itemStyle: { color: '#c64545' } },
          { name: '黄', type: 'bar', stack: 'x', data: d.map(x => x.yellow).reverse(), itemStyle: { color: '#e8a55a' } },
          { name: '蓝', type: 'bar', stack: 'x', data: d.map(x => x.blue).reverse(), itemStyle: { color: '#5db8a6' } },
          { name: '绿', type: 'bar', stack: 'x', data: d.map(x => x.green).reverse(), itemStyle: { color: '#5db872' } }
        ]
      });
    },
    renderMap() {
      const el = document.getElementById('riskMap');
      if (!el) return;
      try {
        if (typeof L === 'undefined') return;
        if (this._dashMap) { this._dashMap.remove(); this._dashMap = null; }
        const dc = { '福海': { lat: 22.6962, lng: 113.8146 }, '福永': { lat: 22.6377, lng: 113.8214 }, '沙井': { lat: 22.7210, lng: 113.7797 }, '新桥': { lat: 22.7420, lng: 113.8304 }, '松岗': { lat: 22.7677, lng: 113.8472 }, '燕罗': { lat: 22.8015, lng: 113.8555 }, '石岩': { lat: 22.6828, lng: 113.9317 }, '航城': { lat: 22.6132, lng: 113.8506 }, '西乡': { lat: 22.5876, lng: 113.8526 }, '新安': { lat: 22.5710, lng: 113.8956 } };
        const stats = this.enhanced.district_stats || [];
        const redDistricts = stats.filter(d => d.red > 0);
        if (!redDistricts.length) return;
        const map = L.map('riskMap', { zoomControl: true }).setView([22.6794, 113.8517], 11);
        L.tileLayer('https://{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { attribution: '© 高德地图', maxZoom: 18, subdomains: ['webrd01', 'webrd02', 'webrd03', 'webrd04'] }).addTo(map);
        const maxCount = Math.max(...redDistricts.map(d => d.red), 1);
        const markers = L.markerClusterGroup({
          maxClusterRadius: 50,
          iconCreateFunction: function(cluster) {
            const children = cluster.getAllChildMarkers();
            let total = 0;
            children.forEach(m => { total += (m._redCount || 0); });
            const s = Math.max(24, Math.min(52, 14 + (total / maxCount) * 30));
            const f = s > 36 ? 12 : s > 26 ? 11 : 10;
            return L.divIcon({
              html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#c64545;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${f}px;font-weight:700;box-shadow:0 0 12px rgba(198,69,69,.6);border:2px solid rgba(255,255,255,.4);line-height:1">${total}</div>`,
              className: '',
              iconSize: [s+4, s+4]
            });
          }
        });
        for (const d of redDistricts) {
          const key = d.district.replace('街道', '');
          const center = dc[key];
          if (!center) continue;
          const size = Math.max(14, Math.min(44, 14 + (d.red / maxCount) * 30));
          const fs = size > 30 ? 11 : size > 20 ? 10 : 9;
          const ts = d.red > 99 ? fs-1 : fs;
          const mk = L.marker([center.lat, center.lng]).bindPopup(`<b>${d.district}</b><br>红色预警 ${d.red}家`);
          mk._redCount = d.red;
          mk.setIcon(L.divIcon({
            className: '',
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#c64545;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${ts}px;font-weight:700;box-shadow:0 0 10px rgba(198,69,69,.5);border:2px solid rgba(255,255,255,.3);line-height:1;font-variant-numeric:tabular-nums">${d.red}</div>`,
            iconSize: [size+4, size+4], iconAnchor: [(size+4)/2, (size+4)/2]
          }));
          markers.addLayer(mk);
        }
        map.addLayer(markers);
        setTimeout(() => map.invalidateSize(), 100);
        this._dashMap = map;
      } catch (e) { console.error(e); }
    },

    // ── Big Screen ──
    openBigScreen() {
      this.bigscreen.active = true;
      this.bigscreen.view = 0;
      this.$nextTick(() => {
        this.renderBigScreenCharts();
        this.startBigScreenRotation();
      });
    },
    closeBigScreen() {
      this.bigscreen.active = false;
      if (this.bigscreen.timer) { clearInterval(this.bigscreen.timer); this.bigscreen.timer = null; }
      if (this._bsMap) { this._bsMap.remove(); this._bsMap = null; }
    },
    nextView() {
      if (this.bigscreen.view < this.bigscreen.views - 1) this.bigscreen.view++;
      this.renderBigScreenCharts();
    },
    prevView() {
      if (this.bigscreen.view > 0) this.bigscreen.view--;
      this.renderBigScreenCharts();
    },
    startBigScreenRotation() {
      if (this.bigscreen.timer) clearInterval(this.bigscreen.timer);
      this.bigscreen.timer = setInterval(() => {
        this.bigscreen.view = (this.bigscreen.view + 1) % this.bigscreen.views;
        this.renderBigScreenCharts();
      }, 8000);
    },
    renderBigScreenCharts() {
      if (!this.bigscreen.active) return;
      if (this.bigscreen.view === 1) this.renderBsTrendChart();
      if (this.bigscreen.view === 2) this.renderBsMap();
      if (this.bigscreen.view === 3) this.renderBsDistrictChart();
    },
    renderBsTrendChart() {
      const el = document.getElementById('bsTrendChart');
      if (!el || !this.enhanced.trend || !this.enhanced.trend.length) return;
      const chart = echarts.init(el);
      const months = this.enhanced.trend.map(t => t.month.substring(5, 7) + '月');
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['红色', '黄色', '蓝色', '绿色'], bottom: 20, textStyle: { fontSize: 14, color: 'rgba(255,255,255,0.7)' } },
        grid: { left: 60, right: 40, top: 40, bottom: 60 },
        xAxis: { type: 'category', data: months, axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
        series: [
          { name: '红色', type: 'line', data: this.enhanced.trend.map(t => t.red), itemStyle: { color: '#ff4d4f' }, smooth: true, lineStyle: { width: 3 }, symbolSize: 8, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,77,79,0.3)' }, { offset: 1, color: 'rgba(255,77,79,0)' }] } } },
          { name: '黄色', type: 'line', data: this.enhanced.trend.map(t => t.yellow), itemStyle: { color: '#d4a017' }, smooth: true, lineStyle: { width: 3 }, symbolSize: 8, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(212,160,23,0.25)' }, { offset: 1, color: 'rgba(212,160,23,0)' }] } } },
          { name: '蓝色', type: 'line', data: this.enhanced.trend.map(t => t.blue), itemStyle: { color: '#1890ff' }, smooth: true, lineStyle: { width: 3 }, symbolSize: 8, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.2)' }, { offset: 1, color: 'rgba(24,144,255,0)' }] } } },
          { name: '绿色', type: 'line', data: this.enhanced.trend.map(t => t.green), itemStyle: { color: '#52c41a' }, smooth: true, lineStyle: { width: 3 }, symbolSize: 8, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.2)' }, { offset: 1, color: 'rgba(82,196,26,0)' }] } } }
        ]
      });
      window.addEventListener('resize', () => chart.resize());
    },
    renderBsMap() {
      const el = document.getElementById('bsMapContainer');
      if (!el) return;
      if (this._bsMap) { this._bsMap.remove(); this._bsMap = null; }
      const dcMap = { '福海': { lat: 22.6962, lng: 113.8146 }, '福永': { lat: 22.6377, lng: 113.8214 }, '沙井': { lat: 22.7210, lng: 113.7797 }, '新桥': { lat: 22.7420, lng: 113.8304 }, '松岗': { lat: 22.7677, lng: 113.8472 }, '燕罗': { lat: 22.8015, lng: 113.8555 }, '石岩': { lat: 22.6828, lng: 113.9317 }, '航城': { lat: 22.6132, lng: 113.8506 }, '西乡': { lat: 22.5876, lng: 113.8526 }, '新安': { lat: 22.5710, lng: 113.8956 } };
      const lc = { '红色预警': '#d93025', '黄色预警': '#f4a100', '蓝色预警': '#1a73e8', '绿色预警': '#0d652d' };
      const ents = this.enterprises.items || [];
      const map = L.map(el, { zoomControl: false }).setView([22.6794, 113.8517], 11);
      L.tileLayer('https://{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { attribution: '© 高德地图', maxZoom: 18, subdomains: ['webrd01', 'webrd02', 'webrd03', 'webrd04'] }).addTo(map);
      const mgroup = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
      for (const ent of ents) {
        if (ent.risk_score < 0) continue;
        let dc = dcMap[ent.district];
        dc = dc ? { lat: dc.lat + (Math.random() - 0.5) * 0.006, lng: dc.lng + (Math.random() - 0.5) * 0.006 } : { lat: 22.65 + (Math.random() - 0.5) * 0.1, lng: 113.83 + (Math.random() - 0.5) * 0.1 };
        const c = lc[ent.risk_level] || '#999';
        const icon = L.divIcon({ className: '', html: `<div style="width:16px;height:16px;border-radius:50%;background:${c};border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        mgroup.addLayer(L.marker([dc.lat, dc.lng], { icon }));
      }
      map.addLayer(mgroup);
      this._bsMap = map;
      setTimeout(() => map.invalidateSize(), 300);
    },
    renderBsDistrictChart() {
      const el = document.getElementById('bsDistrictChart');
      if (!el || !this.enhanced.district_stats || !this.enhanced.district_stats.length) return;
      const chart = echarts.init(el);
      const stats = this.enhanced.district_stats.slice().sort((a, b) => b.total - a.total);
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 80, right: 80, top: 20, bottom: 20, containLabel: true },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'category', data: stats.map(d => d.district).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' } },
        series: [{
          type: 'bar', barWidth: 28,
          data: stats.map(d => ({
            value: d.total,
            itemStyle: { color: d.red > 0 ? '#ff4d4f' : d.yellow > 0 ? '#d4a017' : d.blue > 0 ? '#1890ff' : '#52c41a' }
          })).reverse(),
          label: { show: true, position: 'right', formatter: '{c}家', fontSize: 14, color: 'rgba(255,255,255,0.7)' }
        }]
      });
      window.addEventListener('resize', () => chart.resize());
    },

    // ── Report ──
    openReport() { this.showReport = true; },
    async generateReport() {
      this.showReport = false;
      this.tip('正在生成报告...');
      await this.$nextTick();

      const title = this.reportConfig.title || '宝安区欠薪预警分析报告';
      const now = new Date();
      const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
      const ents = this.enterprises.items || [];
      const trend = this.enhanced.trend || [];
      const districts = this.enhanced.district_stats || [];

      let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + title + '</title><style>';
      html += '*{margin:0;padding:0;box-sizing:border-box;}';
      html += 'body{font-family:"Inter","PingFang SC","Microsoft YaHei",sans-serif;background:#fff;color:#222;padding:40px 60px;max-width:1000px;margin:0 auto;}';
      html += 'h1{font-size:28px;margin-bottom:4px;color:#141413;}';
      html += '.sub{color:#888;font-size:14px;margin-bottom:30px;padding-bottom:16px;border-bottom:2px solid #cc785c;}';
      html += 'h2{font-size:18px;margin:24px 0 12px;padding-left:12px;border-left:3px solid #cc785c;color:#333;}';
      html += '.card{background:#faf9f5;border:1px solid #e6dfd8;border-radius:8px;padding:20px;margin-bottom:16px;}';
      html += '.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;}';
      html += '.metric{text-align:center;padding:16px;border-radius:8px;background:#f5f0e8;}';
      html += '.metric-num{font-size:32px;font-weight:700;}';
      html += '.metric-label{font-size:13px;color:#666;margin-top:4px;}';
      html += '.m-red .metric-num{color:#c64545;}';
      html += '.m-yellow .metric-num{color:#d4a017;}';
      html += '.m-blue .metric-num{color:#1890ff;}';
      html += '.m-green .metric-num{color:#52c41a;}';
      html += 'table{width:100%;border-collapse:collapse;font-size:14px;}';
      html += 'th{text-align:left;padding:8px 10px;border-bottom:2px solid #e6dfd8;color:#666;font-weight:600;}';
      html += 'td{padding:8px 10px;border-bottom:1px solid #e6dfd8;}';
      html += '.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:500;color:#fff;}';
      html += '.badge-red{background:#c64545;}';
      html += '.badge-yellow{background:#d4a017;color:#222;}';
      html += '.badge-blue{background:#1890ff;}';
      html += '.badge-green{background:#52c41a;}';
      html += '.footer{margin-top:30px;padding-top:16px;border-top:1px solid #e6dfd8;font-size:12px;color:#999;text-align:center;}';
      html += '@media print{body{padding:20px 40px;}}';
      html += '</style></head><body>';
      html += '<h1>' + title + '</h1>';
      html += '<div class="sub">宝安区信用办 · 生成日期：' + dateStr + '</div>';
      html += '<div class="metrics">';
      html += '<div class="metric m-red"><div class="metric-num">' + this.dash.red + '</div><div class="metric-label">红色预警</div></div>';
      html += '<div class="metric m-yellow"><div class="metric-num">' + this.dash.yellow + '</div><div class="metric-label">黄色预警</div></div>';
      html += '<div class="metric m-blue"><div class="metric-num">' + this.dash.blue + '</div><div class="metric-label">蓝色预警</div></div>';
      html += '<div class="metric m-green"><div class="metric-num">' + this.dash.green + '</div><div class="metric-label">绿色低风险</div></div>';
      html += '<div class="metric"><div class="metric-num" style="color:#cc785c">' + this.dash.total + '</div><div class="metric-label">监管企业总数</div></div>';
      html += '</div>';

      if (this.reportConfig.includeTrend && trend.length) {
        html += '<h2>风险趋势分析</h2><div class="card"><table><thead><tr><th>月份</th><th>红色</th><th>黄色</th><th>蓝色</th><th>绿色</th></tr></thead><tbody>';
        for (const t of trend) {
          html += '<tr><td>' + t.month + '</td><td style="color:#c64545">' + t.red + '</td><td style="color:#d4a017">' + t.yellow + '</td><td style="color:#1890ff">' + t.blue + '</td><td style="color:#52c41a">' + t.green + '</td></tr>';
        }
        html += '</tbody></table></div>';
      }

      if (this.reportConfig.includeDistricts && districts.length) {
        html += '<h2>街道分布统计</h2><div class="card"><table><thead><tr><th>街道</th><th>总数</th><th>红色</th><th>黄色</th><th>蓝色</th><th>绿色</th></tr></thead><tbody>';
        const sorted = [...districts].sort((a, b) => b.total - a.total);
        for (const d of sorted) {
          html += '<tr><td>' + d.district + '</td><td>' + d.total + '</td><td style="color:#c64545">' + d.red + '</td><td style="color:#d4a017">' + d.yellow + '</td><td style="color:#1890ff">' + d.blue + '</td><td style="color:#52c41a">' + d.green + '</td></tr>';
        }
        html += '</tbody></table></div>';
      }

      if (this.reportConfig.includeTopRisk && ents.length) {
        const riskEnts = ents.filter(e => e.risk_level === '红色预警' || e.is_red_line).sort((a, b) => b.risk_score - a.risk_score).slice(0, 20);
        if (riskEnts.length) {
          html += '<h2>高风险企业列表</h2><div class="card"><table><thead><tr><th>企业名称</th><th>信用代码</th><th>类型</th><th>街道</th><th>风险分</th><th>等级</th><th>红线</th></tr></thead><tbody>';
          for (const e of riskEnts) {
            html += '<tr><td>' + e.name + '</td><td style="font-family:monospace;font-size:13px">' + e.credit_code + '</td><td>' + (e.enterprise_type === 'factory' ? '制造业' : '工程') + '</td><td>' + (e.district || '—') + '</td><td style="font-weight:700;color:#c64545">' + e.risk_score + '</td><td><span class="badge badge-red">' + e.risk_level + '</span></td><td>' + (e.is_red_line ? '⚠ 是' : '否') + '</td></tr>';
          }
          html += '</tbody></table></div>';
        }
      }

      html += '<div class="footer"><p>本报告由宝安区欠薪预警监管平台自动生成</p><p>' + dateStr + '</p></div></body></html>';

      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); }
      this.tip('报告已生成，请在新窗口打印或保存为PDF');
    },

    // ── Init ──
    async fetchAll() {
      await this.fetchDash();
      await Promise.all([this.fetchEnts(), this.fetchEnhancedDash()]);
    }
  },

  mounted() {
    if (localStorage.getItem('wa_logged_in')) this.loggedIn = true;
    this.fetchAll();
    this.$nextTick(() => this.labelTables());
    window.addEventListener('resize', () => this.labelTables());
  }
}).mount('#app');
