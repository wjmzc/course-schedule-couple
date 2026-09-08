'use strict';

/* =========================================================
 *  课程表助手 —— 纯逻辑部分（可在 Node 中单测）
 * ========================================================= */

const DAY_NAMES = ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
const DAY_CN = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7};

const PALETTE = [
  {bg:'#eef2ff', fg:'#3730a3', edge:'#c7d2fe'},
  {bg:'#ecfdf5', fg:'#065f46', edge:'#a7f3d0'},
  {bg:'#fff7ed', fg:'#9a3412', edge:'#fed7aa'},
  {bg:'#fdf2f8', fg:'#9d174d', edge:'#fbcfe8'},
  {bg:'#eff6ff', fg:'#1e40af', edge:'#bfdbfe'},
  {bg:'#f0fdfa', fg:'#115e59', edge:'#99f6e4'},
  {bg:'#faf5ff', fg:'#6b21a8', edge:'#e9d5ff'},
  {bg:'#fef2f2', fg:'#991b1b', edge:'#fecaca'},
  {bg:'#f8fafc', fg:'#334155', edge:'#cbd5e1'},
  {bg:'#fffbeb', fg:'#854d0e', edge:'#fde68a'},
  {bg:'#ecfeff', fg:'#155e75', edge:'#a5f3fc'},
  {bg:'#f5f3ff', fg:'#5b21b6', edge:'#ddd6fe'}
];

const FIELD_NAMES = {
  skip:'— 忽略此列 —', name:'课程名称', teacher:'教师', location:'地点/教室',
  day:'星期', slots:'节次', weeks:'周次', combined:'上课时间(合并解析,含星期/节次/周次)'
};

function range(a,b){ const r=[]; for(let i=a;i<=b;i++) r.push(i); return r; }
function uniqueSorted(arr){ return [...new Set(arr)].sort((a,b)=>a-b); }

/* ---------- 周次解析 ---------- */
// 返回 {weeks:[...], text, ok, error}
function parseWeeksText(s, totalWeeks){
  totalWeeks = totalWeeks || 20;
  const raw = (s==null ? '' : String(s)).trim();
  if(!raw){ return { weeks: range(1,totalWeeks), text:'全周', ok:true }; }

  // 纯单双周 / 全周
  if(!/\d/.test(raw)){
    if(/单/.test(raw) && !/双/.test(raw)) return { weeks: parityWeeks(totalWeeks,1), text:'单周', ok:true };
    if(/双/.test(raw) && !/单/.test(raw)) return { weeks: parityWeeks(totalWeeks,0), text:'双周', ok:true };
    if(/全|每|所有/.test(raw)) return { weeks: range(1,totalWeeks), text:'全周', ok:true };
  }

  let parity = null;
  if(/单/.test(raw) && !/双/.test(raw)) parity = 1;
  else if(/双/.test(raw) && !/单/.test(raw)) parity = 0;

  const clean = raw.replace(/[周星期第节\s（）()\[\]{}]/g,'');
  const nums = [];
  const re = /(\d{1,2})\s*(?:[-~—至～–]\s*(\d{1,2}))?/g;
  let m;
  while((m = re.exec(clean)) !== null){
    let a = parseInt(m[1],10), b = m[2] ? parseInt(m[2],10) : a;
    if(b<a){ const t=a; a=b; b=t; }
    for(let n=a;n<=b;n++){
      if(n<1 || n>totalWeeks) continue;
      if(parity===1 && n%2!==1) continue;
      if(parity===0 && n%2!==0) continue;
      nums.push(n);
    }
  }
  if(nums.length===0 && parity!==null) nums.push(...parityWeeks(totalWeeks,parity));

  const weeks = uniqueSorted(nums);
  if(weeks.length===0) return { weeks:[], text:raw, ok:false, error:'未能识别出有效周次：'+raw };
  const suffix = parity===1 ? '(单)' : (parity===0 ? '(双)' : '');
  return { weeks, text: compressRanges(weeks) + '周' + suffix, ok:true };
}
function parityWeeks(total, parity){ // parity 1=单 0=双
  const out=[]; for(let n=1;n<=total;n++){ if(parity===1 && n%2===1) out.push(n); if(parity===0 && n%2===0) out.push(n); } return out;
}
function compressRanges(nums){
  if(!nums.length) return '';
  const parts=[]; let st=nums[0], prev=nums[0];
  for(let i=1;i<nums.length;i++){
    if(nums[i]===prev+1){ prev=nums[i]; }
    else { parts.push(st===prev? ''+st : st+'-'+prev); st=prev=nums[i]; }
  }
  parts.push(st===prev? ''+st : st+'-'+prev);
  return parts.join(',');
}

// 从一段文字中找出“周次”短语（如 1-16周 / 第1-16周(单) / 单周），找不到返回 ''
const WEEKS_PHRASE_RE = /(?:第\s*)?(?:\d+(?:\s*[-~—至～–]\s*\d+)?(?:\s*[、,，]\s*(?:\d+(?:\s*[-~—至～–]\s*\d+)?))*)\s*周\s*(?:[（(]\s*[单双]\s*[）)])?|[单双]\s*周/g;
function findWeeksText(s){
  const m = String(s||'').match(WEEKS_PHRASE_RE);
  return m ? m[0] : '';
}

/* ---------- 星期 / 节次解析 ---------- */
function parseDay(s){
  if(s==null) return null;
  const t = String(s).trim();
  if(/^[1-7]$/.test(t)) return parseInt(t,10);
  let m = t.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
  if(m && DAY_CN[m[1]]) return DAY_CN[m[1]];
  if(/^[一二三四五六日天]$/.test(t) && DAY_CN[t]) return DAY_CN[t];
  return null;
}
function parseDayText(s){ return parseDay(s); }

function parseSlotRanges(s){
  if(s==null) return [];
  const t = String(s).replace(/[第\s节大]/g,'').replace(/[，；;、]/g,',');
  const nums = [];
  const re = /(\d{1,2})(?:[-~—至～–](\d{1,2}))?/g;
  let m;
  while((m = re.exec(t)) !== null){
    let a = parseInt(m[1],10), b = m[2] ? parseInt(m[2],10) : a;
    if(b<a){ const tmp=a; a=b; b=tmp; }
    if(b>24) continue;                 // 超出合理节次范围的数字(如教室号)忽略
    for(let n=a;n<=b;n++) nums.push(n);
  }
  const u = uniqueSorted(nums);
  const pairs=[]; if(!u.length) return pairs;
  let st=u[0], prev=u[0];
  for(let i=1;i<u.length;i++){
    if(u[i]===prev+1){ prev=u[i]; }
    else { pairs.push([st,prev]); st=prev=u[i]; }
  }
  pairs.push([st,prev]);
  return pairs;
}

/* ---------- 分隔文本解析 ---------- */
function splitLine(line, delim){
  if(delim !== ',') return line.split(delim);
  const out=[]; let cur='', q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){
      if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; }
      else cur+=ch;
    } else {
      if(ch==='"') q=true;
      else if(ch===','){ out.push(cur); cur=''; }
      else cur+=ch;
    }
  }
  out.push(cur);
  return out;
}

function detectDelimiter(text){
  const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return '\t';
  const cands = ['\t',',','，','|',';','；'];
  let best='\t', bestScore=0;
  for(const d of cands){
    let score=0, consistent=0;
    for(let i=0;i<Math.min(lines.length,8);i++){
      const c=(lines[i].match(new RegExp(escRe(d),'g'))||[]).length;
      if(c>0) score+=c;
    }
    // 一致性：前几行非空非表头分隔数相同
    const counts = lines.slice(0,Math.min(lines.length,6)).map(l=>(l.match(new RegExp(escRe(d),'g'))||[]).length);
    const nonZero = counts.filter(c=>c>0);
    if(nonZero.length>=2 && new Set(nonZero).size===1) consistent = nonZero[0]*2;
    const total = score + consistent;
    if(total>bestScore){ bestScore=total; best=d; }
  }
  return best;
}
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// 文本 -> 二维数组。会跳过整行空白
function parseDelimitedRows(text){
  const delim = detectDelimiter(text);
  const rows = String(text||'').split(/\r?\n/).map(l=>l.trimEnd())
    .filter(l=>l.trim().length>0)
    .map(l=>splitLine(l, delim).map(c=>String(c||'').trim()));
  return { delim, rows };
}

/* ---------- 课程表矩阵解析 ---------- */
// 输入二维数组 rows（类似从教务网页/Excel 复制的样式）
// 返回 { ok, courses:[{name,day,start,end,weeksRaw,teacher,location}], errors:[], meta }
function parseMatrixRows(rows){
  const errs = [];
  const grid = (rows||[]).filter(r=>r && r.some(c=>String(c==null?'':c).trim()));
  if(grid.length<2){ return { ok:false, courses:[], errors:['数据行太少'], meta:{} }; }

  // 找包含“星期一~星期日”表头的行
  let hIdx=-1, dayCols={};
  for(let i=0;i<Math.min(grid.length,5);i++){
    const found={};
    grid[i].forEach((cell,ci)=>{ const d=parseDay(cell); if(d) found[ci]=d; });
    if(Object.keys(found).length>=2){ hIdx=i; dayCols=found; break; }
  }
  if(hIdx<0){ return { ok:false, courses:[], errors:['没有找到“星期一~星期日”之类的表头行，请把教务网页的整个课表（含表头）复制进来。'], meta:{} }; }

  const colMax = Math.max(...Object.keys(dayCols).map(Number));
  const courses=[];

  for(let ri=hIdx+1; ri<grid.length; ri++){
    const row = grid[ri];
    if(!row || row.every(c=>!String(c==null?'':c).trim())) continue;
    // 补齐列数
    while(row.length<=colMax) row.push('');
    const rowHint = row[0]||'';
    const fallbackPairs = parseSlotRanges(rowHint);

    for(const ciStr of Object.keys(dayCols)){
      const ci = Number(ciStr);
      const dayCol = dayCols[ci];
      const cell = String(row[ci]==null?'':row[ci]).trim();
      if(!cell) continue;
      const segs = splitCellCourses(cell);
      for(const seg of segs){
        const cand = parseMatrixCell(seg, dayCol, fallbackPairs);
        if(cand.ok){
          // 合并到已存在（同一门课多节）: 简化处理——不合并，直接加
          courses.push(cand.course);
        } else {
          errs.push('第'+(ri+1)+'行 ' + DAY_NAMES[dayCol-1] + '：' + cand.error);
        }
      }
    }
  }
  return { ok:true, courses, errors:errs, meta:{mode:'matrix'} };
}

// 一个单元格里可能用分号/换行写了多门课
function splitCellCourses(cell){
  const lines = cell.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const parts=[];
  for(const ln of lines){
    const segs = ln.split(/[;；]/).map(x=>x.trim()).filter(Boolean);
    parts.push(...segs);
  }
  return parts.length? parts : [cell];
}

function parseMatrixCell(text, colDay, fallbackPairs){
  const weeksText = findWeeksText(text);
  let rest = weeksText ? text.replace(weeksText,'') : text;
  const day = parseDayText(rest) || colDay;
  // 去掉“周X”与“第x-x节”片段，剩下的当名称/教师/地点
  rest = rest.replace(/(?:周|星期|礼拜)[一二三四五六日天]/g,' ');
  rest = rest.replace(/(?:第)?\s*\d{1,2}(?:\s*[、,，]\s*\d{1,2}|\s*[-~—至～–]\s*\d{1,2})*\s*节/g,' ');
  const pairs = parseSlotRanges(text.replace(weeksText,''));
  const usePairs = pairs.length? pairs : fallbackPairs;
  if(!day) return { ok:false, error:'无法识别星期' };
  if(!usePairs.length) return { ok:false, error:'无法识别节次（请确认第1列是节次，如“1-2”）' };

  const { name, teacher, location } = splitNameTeacherLocation(rest);
  if(!name) return { ok:false, error:'无法识别课程名称' };
  const pair = usePairs[0];
  return { ok:true, course:{ name, day, start:pair[0], end:pair[1], weeksRaw:weeksText, teacher, location } };
}

// 从剩余文字里尽量拆出 名称/教师/地点
function splitNameTeacherLocation(text){
  const t = String(text||'').replace(/[|｜]/g,' ').replace(/[【】\[\]（）()]/g,' ');
  const tokens = t.split(/\s+/).map(x=>x.trim()).filter(Boolean);
  if(!tokens.length) return { name:'', teacher:'', location:'' };
  let name = tokens[0];
  // 名称若带编号如 “(A)” 已处理；如果第1个词太短(<=1)且后面还有，拼上前面的词
  const locIdx = tokens.findIndex(tk => isLocationToken(tk));
  let location='', teacher='';
  if(locIdx>0){
    location = tokens[locIdx];
    const restTokens = tokens.filter((_,i)=>i!==locIdx);
    name = restTokens[0]||'';
    teacher = restTokens.slice(1).join(' ');
  } else {
    name = tokens[0];
    teacher = tokens.slice(1).join(' ');
  }
  if(name.length<=1 && teacher){ name = (name+' '+teacher).trim(); teacher=''; }
  return { name, teacher, location };
}
function isLocationToken(tk){
  if(/[室楼馆教阶梯堂操场馆场区]/.test(tk)) return true;
  if(/^[A-Za-z]{0,3}\d{2,4}(?:[-－]\d+)?$/.test(tk)) return true; // 如 A101 / 1-201
  return false;
}

/* ---------- 明细(长表格)解析 ---------- */
// 合并上课时间列，如 “周一第3,4节{第1-16周};周三第1,2节{第3-16周(双)}”
function parseCombinedSegments(text){
  const segs = String(text||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  for(const seg of segs){
    if(!seg) continue;
    const weeksText = findWeeksText(seg);
    const seg2 = weeksText ? seg.replace(weeksText,'') : seg;
    const day = parseDayText(seg2);
    const pairs = parseSlotRanges(seg2);
    if(day && pairs.length){
      for(const p of pairs) out.push({ day, start:p[0], end:p[1], weeksRaw:weeksText });
    }
  }
  return out;
}

// 根据表头猜字段
function guessMapping(headers){
  const map = [];
  (headers||[]).forEach((h,idx)=>{
    const s = String(h==null?'':h).trim();
    let type='name';
    if(!s) type='skip';
    else if(/教师|老师|任课|授课/.test(s)) type='teacher';
    else if(/教室|地点|场地|上课地|教学楼|校区/.test(s)) type='location';
    else if(/星期|周几|礼拜/.test(s)) type='day';
    else if(/上课时间|起止时间|上课节次|时间/.test(s)) type='combined';
    else if(/节次|节数|第.*节/.test(s)) type='slots';
    else if(/周次|周数|上课周|周[（(]/.test(s)) type='weeks';
    else if(/课程|名称|科目|课名/.test(s)) type='name';
    else type='skip';
    map.push(type);
  });
  return map;
}

// 无表头时按数据特征猜
function guessMappingByData(rows){
  const n = rows.length, sampleN = Math.min(n, 60);
  const scores=[];
  for(let c=0;c<20;c++){
    const sc={day:0,slots:0,weeks:0,text:0};
    let cnt=0;
    for(let i=0;i<sampleN;i++){
      const v = String(rows[i][c]==null?'':rows[i][c]).trim();
      if(!v) continue; cnt++;
      if(parseDay(v)!==null) sc.day++;
      else if(parseSlotRanges(v).length) sc.slots++;
      else if(findWeeksText(v)) sc.weeks++;
      else sc.text++;
    }
    sc._cnt=cnt;
    scores.push(sc);
  }
  const pick=(key)=> scores.reduce((bi,sc,i)=> sc[key]> (bi<0?0:scores[bi][key]) ? i : bi, -1);
  const dayC = pick('day'), slotC = pick('slots'), weekC = pick('weeks');
  const map = [];
  for(let c=0;c<scores.length;c++){
    let type='name';
    if(scores[c]._cnt===0) type='skip';
    else if(c===dayC && scores[dayC].day>0) type='day';
    else if(c===slotC && scores[slotC].slots>0 && c!==dayC) type='slots';
    else if(c===weekC && scores[weekC].weeks>0 && c!==dayC && c!==slotC) type='weeks';
    else if(c===0) type='name';
    else type='skip';
    map.push(type);
  }
  return map;
}

// 生成候选课程
function buildLongCandidates(rows, mapping, hasHeader){
  const courses=[], errors=[];
  const start = hasHeader ? 1 : 0;
  for(let i=start;i<rows.length;i++){
    const row = rows[i];
    const cell = (type)=> {
      const idx = mapping.indexOf(type);
      if(idx<0) return '';
      return String(row[idx]==null?'':row[idx]).trim();
    };
    const name = cell('name');
    const combined = cell('combined');
    const dayV = cell('day'), slotsV = cell('slots'), weeksV = cell('weeks');
    const teacher = cell('teacher'), location = cell('location');
    if(!name && !combined){ errors.push('第'+(i+1)+'行：缺少课程名称'); continue; }

    // 优先合并列
    let day = parseDay(dayV), pairs = parseSlotRanges(slotsV), weeksRaw = weeksV||'';
    if(!day && dayV && parseDayText(dayV)) day = parseDayText(dayV);
    if(combined){
      const segs = parseCombinedSegments(combined);
      for(const sg of segs){
        const d = sg.day || day;
        if(!d){ errors.push('第'+(i+1)+'行：上课时间无法识别星期 ('+combined+')'); continue; }
        courses.push({ name: name||'未命名', day:d, start:sg.start, end:sg.end, weeksRaw: sg.weeksRaw||weeksRaw, teacher, location });
      }
      continue;
    }
    if(!name){ errors.push('第'+(i+1)+'行：缺少课程名称'); continue; }
    if(!day){ errors.push('第'+(i+1)+'行：缺少/无法识别星期 ('+name+')'); continue; }
    if(!pairs.length){ errors.push('第'+(i+1)+'行：缺少/无法识别节次 ('+name+')'); continue; }
    for(const p of pairs) courses.push({ name, day, start:p[0], end:p[1], weeksRaw, teacher, location });
  }
  return { courses, errors };
}

// 便于 Node 单测
if (typeof module !== 'undefined' && module.exports){
  module.exports = { parseWeeksText, findWeeksText, parseDay, parseSlotRanges, parseDelimitedRows,
    parseMatrixRows, parseCombinedSegments, guessMapping, guessMappingByData, buildLongCandidates,
    splitNameTeacherLocation, DAY_NAMES, PALETTE, compressRanges };
}
/* =========================================================
 *  界面部分
 * ========================================================= */
(function(){
if (typeof document === 'undefined') return; // Node 单测时跳过

const $ = id => document.getElementById(id);
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function defaultPeriods(){
  const times = ['08:00-08:45','08:55-09:40','10:00-10:45','10:55-11:40','14:00-14:45','14:55-15:40',
    '16:00-16:45','16:55-17:40','19:00-19:45','19:55-20:40','20:50-21:35','21:45-22:30'];
  return times.map((t,i)=>({ label:String(i+1), time:t }));
}

/* ---------- 状态 ---------- */
const STORE_KEY = 'courseScheduleApp.v1';
let state = {
  totalWeeks: 20,
  startDate: '',          // 开学第一周周一，用于算“本周”
  currentWeek: 1,
  periods: defaultPeriods(),
  mappins: [],
  uiView: (typeof window!=='undefined' && window.innerWidth<=820) ? 'list' : 'grid',
  courses: []
};

function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    state.totalWeeks = clampInt(d.totalWeeks, 1, 40, 20);
    state.startDate = d.startDate || '';
    state.currentWeek = clampInt(d.currentWeek, 1, state.totalWeeks, 1);
    if(Array.isArray(d.periods) && d.periods.length) state.periods = d.periods;
    else state.periods = defaultPeriods();
    state.mappins = Array.isArray(d.mappins)? d.mappins : [];
    state.uiView = (d.uiView==='list'||d.uiView==='grid') ? d.uiView : ((typeof window!=='undefined' && window.innerWidth<=820) ? 'list' : 'grid');
    state.courses = (Array.isArray(d.courses)? d.courses : []).map(c=>({
      id: c.id || uid(), name: c.name||'未命名', teacher: c.teacher||'', location: c.location||'',
      day: clampInt(c.day,1,7,1), start: clampInt(c.start,1,30,1), end: clampInt(c.end, c.start||1,30,c.start||1),
      weeksRaw: c.weeksRaw||'', color: c.color!=null? c.color : colorIndex(c.name)
    }));
  }catch(e){ console.warn('load failed', e); }
}
function clampInt(v,min,max,def){ v = parseInt(v,10); if(isNaN(v)) return def; return Math.max(min, Math.min(max,v)); }
let __uid = Date.now()%100000;
function uid(){ return 'c'+(__uid++).toString(36)+Math.random().toString(36).slice(2,7); }

function colorIndex(name){
  let h=0; for(const ch of String(name||'x')) h=(h*31 + ch.codePointAt(0))>>>0;
  return h % PALETTE.length;
}
function courseActiveWeeks(c){
  return parseWeeksText(c.weeksRaw, state.totalWeeks);
}

/* ---------- Toast ---------- */
function toast(msg, type){
  const wrap = $('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + (type||'ok');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; }, 2600);
  setTimeout(()=> el.remove(), 3000);
}

/* ---------- 顶部状态 ---------- */
function setWeekStatus(){
  const w = state.currentWeek;
  $('weekInput').value = w;
  $('weekTotalLabel').textContent = '/ ' + state.totalWeeks + ' 周';
  const list = state.courses.filter(c=>courseActiveWeeks(c).weeks.includes(w));
  $('weekStatus').textContent = '第 ' + w + ' 周';
  $('courseCount').textContent = '本周 ' + list.length + ' 门课';
  const d = weekDates(w);
  if(d) $('dateHint').textContent = d;
  else $('dateHint').textContent = '';
}
function weekDates(week){
  if(!state.startDate) return '';
  const ms = Date.parse(state.startDate + 'T00:00:00');
  if(isNaN(ms)) return '';
  const mon = new Date(ms + (week-1)*7*86400000);
  const sun = new Date(ms + (week-1)*7*86400000 + 6*86400000);
  const fmt = dt => (dt.getMonth()+1)+'月'+dt.getDate()+'日';
  return fmt(mon) + ' ~ ' + fmt(sun);
}

/* ---------- 课程表渲染 ---------- */
const ROW_H = 64;
function maxPeriodsNeeded(){
  let mx = state.periods.length;
  for(const c of state.courses) mx = Math.max(mx, c.end);
  return Math.min(mx, 30);
}

function renderAll(){
  updateViewSwitch();
  setWeekStatus();
  renderTimetable();
}
function renderTimetable(){
  const wrap = $('timetableWrap'), empty = $('emptyState');
  const has = state.courses.length>0;
  wrap.hidden = !has;
  empty.hidden = has;
  if(!has) return;
  updateViewSwitch();
  if(state.uiView==='list'){ renderListView(); return; }
  renderLegend();
  const tt = $('timetable');
  const week = state.currentWeek;
  const total = maxPeriodsNeeded();
  const startDate = state.startDate;

  // 表头
  let html = '<div class="tt-head"><div></div>';
  for(let d=0; d<7; d++){
    let sub='';
    if(startDate){
      const ms = Date.parse(startDate + 'T00:00:00');
      if(!isNaN(ms)){
        const dt = new Date(ms + (week-1)*7*86400000 + d*86400000);
        sub = '<span class="dow-sub">'+(dt.getMonth()+1)+'/'+dt.getDate()+'</span>';
      }
    }
    html += '<div>' + DAY_NAMES[d] + sub + '</div>';
  }
  html += '</div>';

  // 左侧时间列
  html += '<div class="tt-body"><div class="tt-time">';
  for(let i=0;i<total;i++){
    const p = state.periods[i] || { label:String(i+1), time:'' };
    html += '<div class="rowsep"><b>' + esc(p.label) + '</b>' + (p.time? '<span>'+esc(p.time)+'</span>':'') + '</div>';
  }
  html += '</div>';

  // 每天课程卡片
  for(let d=1; d<=7; d++){
    const cs = state.courses.filter(c=> c.day===d && courseActiveWeeks(c).weeks.includes(week));
    const lanes = layoutCourses(cs);
    html += '<div class="tt-day" data-day="'+d+'" style="height:'+(total*ROW_H)+'px">';
    html += '<div class="bgrows">';
    for(let i=0;i<total;i++) html += '<div class="bgrow'+(i===total-1?' last':'')+'" data-slot="'+(i+1)+'"></div>';
    html += '</div><div class="cards">';
    for(const lane of lanes){
      const c = lane.course;
      const pal = PALETTE[c.color % PALETTE.length];
      const top = (c.start-1)*ROW_H + 3;
      const height = (c.end - c.start + 1)*ROW_H - 6;
      const left = lane.left + '%', width = lane.width + '%';
      const aw = courseActiveWeeks(c);
      const tag = (aw.text && aw.text!=='全周') ? aw.text : '';
      html += '<div class="course-card" data-id="'+esc(c.id)+'" style="top:'+top+'px;height:'+height+'px;left:'+left+';width:'+width+';background:'+pal.bg+';color:'+pal.fg+';border-left-color:'+pal.edge+'">'
        + '<div class="c-name">'+esc(c.name)+'</div>'
        + (c.location? '<div class="c-meta">📍 '+esc(c.location)+'</div>':'')
        + (c.teacher? '<div class="c-meta">👤 '+esc(c.teacher)+'</div>':'')
        + (tag? '<div class="c-tag">'+esc(tag)+'</div>':'')
        + '</div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  tt.innerHTML = html;

  // 绑定事件：卡片点击 -> 编辑；空白点击 -> 新建
  tt.querySelectorAll('.course-card').forEach(el=>{
    el.addEventListener('click', ev=>{ ev.stopPropagation(); openCourseById(el.dataset.id); });
  });
  tt.querySelectorAll('.bgrow').forEach(el=>{
    el.addEventListener('click', ()=>{
      const dayEl = el.closest('.tt-day');
      openCourse(null, { day:+dayEl.dataset.day, start:+el.dataset.slot, end:+el.dataset.slot });
    });
  });
}

// 把同一天重叠的课分成若干“道”，返回带 left/width 的布局
function layoutCourses(courses){
  const sorted = [...courses].sort((a,b)=> a.start-b.start || b.end-a.end);
  const lanes=[];
  for(const c of sorted){
    let placed=false;
    for(const lane of lanes){
      if(!lane.some(o=> overlaps(o,c))){ lane.push(c); placed=true; break; }
    }
    if(!placed) lanes.push([c]);
  }
  const out=[];
  const n = lanes.length;
  lanes.forEach((lane, li)=>{
    for(const c of lane){
      out.push({ course:c, left: (li*100)/n, width: 100/n });
    }
  });
  return out;
}
function overlaps(a,b){ return a.start<=b.end && b.start<=a.end; }

function renderLegend(){
  const names = {};
  for(const c of state.courses){
    if(!names[c.name]){ names[c.name]=1; }
    else names[c.name]++;
  }
  const arr = Object.keys(names).sort();
  const el = $('legend');
  if(arr.length<=1){ el.innerHTML=''; return; }
  el.innerHTML = arr.map(n=>{
    const c = state.courses.find(x=>x.name===n);
    const pal = PALETTE[(c? c.color:0) % PALETTE.length];
    return '<span class="lg-item"><span class="swatch" style="background:'+pal.bg+';border:1px solid '+pal.edge+'"></span>'+esc(n)+'</span>';
  }).join('');
}

/* ---------- 课程编辑对话框 ---------- */
let editingId = null;
function fillSlotSelects(selStart, selEnd, curS, curE){
  const maxN = Math.max(24, maxPeriodsNeeded());
  let oh='';
  for(let i=1;i<=maxN;i++) oh += '<option value="'+i+'">第 '+i+' 节</option>';
  selStart.innerHTML = oh; selEnd.innerHTML = oh;
  selStart.value = curS; selEnd.value = curE;
  selEnd.onchange = ()=>{ if(parseInt(selEnd.value,10) < parseInt(selStart.value,10)) selEnd.value = selStart.value; };
  selStart.onchange = ()=>{ if(parseInt(selEnd.value,10) < parseInt(selStart.value,10)) selEnd.value = selStart.value; };
}
function buildColorPicker(sel){
  const box = $('colorPicker');
  box.innerHTML = PALETTE.map((p,i)=>'<div class="color-swatch'+(i===sel?' sel':'')+'" data-i="'+i+'" style="background:'+p.bg+';border-color:'+p.edge+'" title="颜色'+(i+1)+'"></div>').join('');
  box.querySelectorAll('.color-swatch').forEach(el=>{
    el.addEventListener('click', ()=>{
      box.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel'));
      el.classList.add('sel');
    });
  });
}
function pickedColor(){
  const el = $('colorPicker').querySelector('.color-swatch.sel');
  return el? parseInt(el.dataset.i,10) : 0;
}
function updateWeeksHint(){
  const raw = $('f_weeks').value.trim();
  const r = parseWeeksText(raw, state.totalWeeks);
  const hint = $('f_weeks_hint');
  if(r.ok){
    if(raw==='' || r.text==='全周') hint.textContent = '每周都上（1～'+state.totalWeeks+'周）';
    else hint.textContent = '将在以下周上课：' + compressRanges(r.weeks) + ' 周（共 '+r.weeks.length+' 周）';
  } else {
    hint.textContent = r.error || '无法识别';
  }
}
function openCourseById(id){
  const c = state.courses.find(x=>x.id===id);
  if(c) openCourse(c);
}
function openCourse(course, prefill){
  editingId = course ? course.id : null;
  $('courseDlgTitle').textContent = course? '编辑课程' : '添加课程';
  $('f_name').value = course? course.name : (prefill&&prefill.name? prefill.name : '');
  $('f_teacher').value = course? (course.teacher||'') : '';
  $('f_location').value = course? (course.location||'') : '';
  $('f_day').value = course? course.day : (prefill&&prefill.day? prefill.day : 1);
  fillSlotSelects($('f_start'), $('f_end'), course? course.start : (prefill? prefill.start : 1), course? course.end : (prefill? prefill.end : 1));
  $('f_weeks').value = course? (course.weeksRaw||'') : '';
  buildColorPicker(course? course.color : (prefill&&prefill.name? colorIndex(prefill.name) : 0));
  updateWeeksHint();
  $('btnDeleteCourse').hidden = !course;
  $('courseDlg').showModal();
}
function saveCourse(){
  const name = $('f_name').value.trim();
  if(!name){ toast('请填写课程名称','err'); return; }
  const day = parseInt($('f_day').value,10);
  const start = parseInt($('f_start').value,10);
  const end = parseInt($('f_end').value,10);
  const weeksRaw = $('f_weeks').value.trim();
  const wr = parseWeeksText(weeksRaw, state.totalWeeks);
  if(!wr.ok){ toast(wr.error||'周次格式有误','err'); return; }
  const obj = {
    id: editingId || uid(),
    name, teacher: $('f_teacher').value.trim(), location: $('f_location').value.trim(),
    day, start, end, weeksRaw: wr.text==='全周'? '' : (weeksRaw||''), color: pickedColor()
  };
  if(editingId){
    const i = state.courses.findIndex(c=>c.id===editingId);
    if(i>=0) state.courses[i] = obj;
  } else {
    state.courses.push(obj);
  }
  save(); renderAll();
  $('courseDlg').close();
  toast(editingId? '已保存修改' : '已添加：'+name);
}
function deleteCourse(){
  if(!editingId) return;
  const i = state.courses.findIndex(c=>c.id===editingId);
  if(i>=0){
    const n = state.courses[i].name;
    state.courses.splice(i,1);
    save(); renderAll(); $('courseDlg').close();
    toast('已删除：'+n,'warn');
  }
}

/* ---------- 设置对话框 ---------- */
function openSettings(){
  $('s_startDate').value = state.startDate || '';
  $('s_totalWeeks').value = state.totalWeeks;
  $('s_periods').value = state.periods.map(p=> (p.label||'') + (p.time? '|'+p.time : '')).join('\n');
  $('settingsDlg').showModal();
}
function saveSettings(){
  const total = clampInt($('s_totalWeeks').value, 1, 40, 20);
  const startDate = $('s_startDate').value || '';
  const periods = [];
  $('s_periods').value.split(/\r?\n/).forEach((ln,idx)=>{
    const t = ln.trim(); if(!t) return;
    const [label, time] = t.split('|').map(x=>x.trim());
    periods.push({ label: label || String(idx+1), time: time || '' });
  });
  state.totalWeeks = total;
  state.startDate = startDate;
  if(periods.length) state.periods = periods;
  state.currentWeek = clampInt(state.currentWeek, 1, total, 1);
  save(); renderAll();
  $('settingsDlg').close();
  toast('设置已保存');
}
function confirmClear(){
  if(!state.courses.length){ toast('当前没有课程','warn'); return; }
  if(!confirm('确定清空全部课程吗？此操作不可撤销。')) return;
  state.courses = [];
  save(); renderAll();
  toast('已清空全部课程','warn');
}

/* ---------- 示例数据 ---------- */
function loadSample(){
  const weeks = [
    {name:'高等数学', teacher:'王明老师', location:'教1-201', day:1, start:1, end:2, weeksRaw:'1-16周'},
    {name:'大学英语', teacher:'李华老师', location:'外语楼302', day:2, start:3, end:4, weeksRaw:'1-8周'},
    {name:'线性代数', teacher:'张伟老师', location:'教2-105', day:3, start:1, end:2, weeksRaw:'3-16周(双)'},
    {name:'大学物理', teacher:'赵敏老师', location:'理综楼B305', day:3, start:3, end:4, weeksRaw:'1-16周(单)'},
    {name:'程序设计', teacher:'刘洋老师', location:'计算机楼201', day:4, start:5, end:6, weeksRaw:'1-16周'},
    {name:'体育', teacher:'陈晨老师', location:'东区操场', day:5, start:7, end:8, weeksRaw:'1-8周'},
    {name:'形势与政策', teacher:'周涛老师', location:'教3-110', day:5, start:9, end:10, weeksRaw:'9-16周'},
    {name:'大学英语听力', teacher:'李华老师', location:'外语楼语音室', day:2, start:7, end:8, weeksRaw:'3-12周'},
    {name:'毛概', teacher:'吴军老师', location:'教1-305', day:6, start:1, end:2, weeksRaw:'1-16周(双)'}
  ];
  state.courses = weeks.map(w=>Object.assign({ id:uid(), color:colorIndex(w.name) }, w));
  save(); renderAll();
  toast('已载入示例课表：试试切换不同周次看变化');
}
/* ---------- 导入对话框 ---------- */
let importState = null; // { rows, hasHeader, mapping }
let pendingCourses = [];
let pendingErrors = [];

function resetImportUI(){
  importState = null; pendingCourses = []; pendingErrors = [];
  $('importStep2').hidden = true;
  $('importFoot').hidden = true;
  $('mappingArea').innerHTML = '';
  $('previewArea').innerHTML = '';
  $('replaceFirst').checked = false;
}

function switchImportTab(tab){
  document.querySelectorAll('#importTabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  $('panel-paste').hidden = tab!=='paste';
  $('panel-file').hidden = tab!=='file';
}

function currentSrcMode(){
  const el = document.querySelector('input[name="srcMode"]:checked');
  return el? el.value : 'matrix';
}

function analyzeRows(rows, mode){
  if(!rows || !rows.length){ toast('没有可解析的数据','err'); return; }
  resetImportUI();
  if(mode==='matrix'){
    const res = parseMatrixRows(rows, state.periods);
    if(!res.ok){ toast(res.errors[0]||'解析失败','err'); renderErrors(res.errors); return; }
    pendingCourses = res.courses; pendingErrors = res.errors;
    $('importStep2').hidden = false;
    $('importFoot').hidden = false;
    renderPreview('matrix');
    return;
  }
  // 长表格
  const headers = rows[0] || [];
  const hasHeader = isHeaderRow(headers);
  let mapping;
  if(hasHeader) mapping = guessMapping(headers);
  else mapping = guessMappingByData(rows);
  importState = { rows, hasHeader, mapping };
  renderMapping();
  rebuildLongPreview();
  $('importStep2').hidden = false;
  $('importFoot').hidden = false;
}

function isHeaderRow(headers){
  return (headers||[]).some(h=>{
    const s = String(h==null?'':h);
    return /课程|名称|科目|课名|教师|老师|任课|星期|周几|周次|节次|时间|地点|教室/.test(s);
  });
}

function renderMapping(){
  const rows = importState.rows;
  const headers = importState.hasHeader ? rows[0] : null;
  const dataSample = headers ? rows.slice(1,4) : rows.slice(0,4);
  const maxCols = Math.max(headers? headers.length : 0, ...dataSample.map(r=>r.length), 1);

  let html = '<div class="section-title">① 请核对每一列对应的内容（可修改下拉框）</div>';
  html += '<label class="check" style="margin-bottom:8px"><input type="checkbox" id="hasHeaderBox"'+(importState.hasHeader?' checked':'')+'> 第 1 行是表头（列名）</label>';
  html += '<div style="overflow:auto;max-height:240px"><table class="map-tbl"><thead><tr><th>源列</th><th>识别为</th><th>样例数据</th></tr></thead><tbody>';
  for(let c=0;c<maxCols;c++){
    const head = headers? String(headers[c]==null?'':headers[c]) : ('第'+(c+1)+'列');
    const samples = dataSample.map(r=> String(r[c]==null?'':r[c])).filter(s=>s).slice(0,3).join(' ｜ ') || '（空）';
    const cur = importState.mapping[c] || 'skip';
    html += '<tr><td>' + esc(head || ('列'+(c+1))) + '</td>'
      + '<td class="select-cell"><select data-col="'+c+'">'
      + Object.keys(FIELD_NAMES).map(k=>'<option value="'+k+'"'+(k===cur?' selected':'')+'>'+FIELD_NAMES[k]+'</option>').join('')
      + '</select></td>'
      + '<td class="wrap">' + esc(samples) + '</td></tr>';
  }
  html += '</tbody></table></div>';
  $('mappingArea').innerHTML = html;

  $('mappingArea').querySelectorAll('select[data-col]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const c = +sel.dataset.col;
      importState.mapping[c] = sel.value;
      rebuildLongPreview();
    });
  });
  const hb = $('hasHeaderBox');
  if(hb) hb.addEventListener('change', ()=>{
    importState.hasHeader = hb.checked;
    if(hb.checked) importState.mapping = guessMapping(importState.rows[0]||[]);
    else importState.mapping = guessMappingByData(importState.rows);
    renderMapping();
    rebuildLongPreview();
  });
}

function rebuildLongPreview(){
  if(!importState) return;
  const res = buildLongCandidates(importState.rows, importState.mapping, importState.hasHeader);
  pendingCourses = res.courses; pendingErrors = res.errors;
  renderPreview('long');
}

function renderErrors(errs){
  if(!errs || !errs.length) return;
  let html = '<div class="section-title" style="color:#b45309">⚠ 无法识别（' + errs.length + ' 条，可在导入后手动添加）</div>';
  html += '<div class="preview-list" style="max-height:140px"><table><tbody>';
  errs.slice(0,60).forEach(e=>{ html += '<tr><td class="err">'+esc(e)+'</td></tr>'; });
  if(errs.length>60) html += '<tr><td class="err">…… 还有 '+(errs.length-60)+' 条</td></tr>';
  html += '</tbody></table></div>';
  $('previewArea').insertAdjacentHTML('beforeend', html);
}

function renderPreview(mode){
  const area = $('previewArea');
  area.innerHTML = '';
  const cs = pendingCourses;
  if(mode==='matrix'){
    area.insertAdjacentHTML('afterbegin','<div class="section-title">✅ 识别到 '+cs.length+' 门课（按下面预览导入，之后可点卡片修改）</div>');
  } else {
    const used = (importState.mapping||[]).filter(t=>t!=='skip' && t!==undefined).length;
    area.insertAdjacentHTML('afterbegin','<div class="section-title">✅ 识别到 '+cs.length+' 门课（已用 '+used+' 列）</div>');
  }
  if(!cs.length){
    area.insertAdjacentHTML('beforeend','<p class="help">没有识别到课程，请检查粘贴内容 / 列映射是否正确。</p>');
  } else {
    let html = '<div class="preview-list"><table><thead><tr><th>#</th><th>课程</th><th>星期</th><th>节次</th><th>周次</th><th>教师</th><th>地点</th></tr></thead><tbody>';
    cs.slice(0,200).forEach((c,i)=>{
      const wk = parseWeeksText(c.weeksRaw, state.totalWeeks);
      html += '<tr><td>'+(i+1)+'</td><td>'+esc(c.name)+'</td><td>'+DAY_NAMES[c.day-1]+'</td>'
        + '<td>'+(c.start===(c.end||c.start)? c.start : c.start+'-'+c.end)+' 节</td>'
        + '<td>'+esc(wk.text)+'</td><td>'+esc(c.teacher||'')+'</td><td>'+esc(c.location||'')+'</td></tr>';
    });
    if(cs.length>200) html += '<tr><td colspan="7">…… 仅预览前 200 条，共 '+cs.length+' 条</td></tr>';
    html += '</tbody></table></div>';
    area.insertAdjacentHTML('beforeend', html);
  }
  renderErrors(pendingErrors);
  $('btnConfirmImport').textContent = '✅ 确认导入 (' + cs.length + ')';
}

function confirmImport(){
  if(!pendingCourses.length){ toast('没有可导入的课程','warn'); return; }
  if($('replaceFirst').checked) state.courses = [];
  const seen = new Set(state.courses.map(keyOfCourse));
  let added = 0, dup = 0;
  for(const c of pendingCourses){
    const key = keyOfCourse(c);
    if(seen.has(key)){ dup++; continue; }
    seen.add(key);
    state.courses.push({
      id: uid(), name: c.name||'未命名', teacher: c.teacher||'', location: c.location||'',
      day: c.day, start: c.start, end: Math.max(c.end, c.start), weeksRaw: c.weeksRaw||'',
      color: colorIndex(c.name||'')
    });
    added++;
  }
  save(); renderAll();
  const dlg = $('importDlg'); dlg.close();
  resetImportUI();
  let msg = '成功导入 ' + added + ' 门课';
  if(dup) msg += '（跳过 ' + dup + ' 条重复）';
  if(pendingErrors.length) msg += '；另有 ' + pendingErrors.length + ' 行未能识别，可手动添加';
  toast(msg, pendingErrors.length? 'warn' : 'ok');
}
function keyOfCourse(c){
  return [c.name, c.day, c.start, c.end, c.weeksRaw||'', c.teacher||'', c.location||''].join('|');
}

/* ---------- 文件读取 ---------- */
function readFileText(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(String(fr.result||''));
    fr.onerror = ()=> rej(fr.error);
    fr.readAsText(file, 'utf-8');
  });
}
async function analyzeFile(file){
  const name = (file.name||'').toLowerCase();
  try{
    if(/\.(xlsx|xls)$/.test(name)){
      if(typeof XLSX === 'undefined'){
        toast('解析 Excel 需要联网加载解析库，请联网后重试；或先另存为 CSV 再上传','err');
        return;
      }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' })
        .map(r=>r.map(c=>String(c==null?'':c).trim()))
        .filter(r=>r.some(c=>c));
      analyzeRows(rows, currentSrcMode());
    } else {
      const text = await readFileText(file);
      analyzeText(text, currentSrcMode());
    }
  }catch(e){
    console.error(e);
    toast('文件解析失败：' + (e&&e.message? e.message : e), 'err');
  }
}
function analyzeText(text, mode){
  if(!text || !text.trim()){ toast('内容为空','err'); return; }
  const { rows } = parseDelimitedRows(text);
  analyzeRows(rows, mode);
}

/* ---------- 菜单与备份 ---------- */
function toggleMenu(show){
  $('menu').hidden = show===undefined? !$('menu').hidden : !show;
}
function exportBackup(){
  const data = { version:1, savedAt:new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '课程表备份-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  toast('备份已下载');
}
function importBackupFile(file){
  readFileText(file).then(text=>{
    try{
      const data = JSON.parse(text);
      const s = data && data.state ? data.state : data;
      if(!s || !Array.isArray(s.courses)) throw new Error('不是有效的备份文件');
      if(!confirm('恢复备份将覆盖当前全部数据，确定继续？')) return;
      const old = state;
      state = {
        totalWeeks: clampInt(s.totalWeeks,1,40,20),
        startDate: s.startDate||'',
        currentWeek: clampInt(s.currentWeek,1,s.totalWeeks||20,1),
        periods: (Array.isArray(s.periods)&&s.periods.length)? s.periods : defaultPeriods(),
        courses: (s.courses||[]).map(c=>({
          id:c.id||uid(), name:c.name||'未命名', teacher:c.teacher||'', location:c.location||'',
          day:clampInt(c.day,1,7,1), start:clampInt(c.start,1,30,1), end:clampInt(c.end,c.start||1,30,c.start||1),
          weeksRaw:c.weeksRaw||'', color:c.color!=null?c.color:colorIndex(c.name||'')
        }))
      };
      save(); renderAll();
      toast('备份恢复成功（'+state.courses.length+' 门课）');
    }catch(e){
      toast('恢复失败：'+(e&&e.message?e.message:e),'err');
    }
  });
}

/* ---------- 周切换 ---------- */
function goWeek(w){
  state.currentWeek = Math.max(1, Math.min(state.totalWeeks, w));
  save(); renderAll();
}
function thisWeekFromDate(){
  if(!state.startDate){
    toast('请先在“设置”里填写开学日期，才能计算“本周”','warn');
    openSettings();
    return;
  }
  const ms = Date.parse(state.startDate + 'T00:00:00');
  if(isNaN(ms)){ toast('开学日期格式不正确','err'); return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - ms)/86400000);
  const w = diff<0 ? 1 : Math.floor(diff/7)+1;
  goWeek(w);
}

/* ---------- 事件绑定 ---------- */
function bindEvents(){
  // 周导航
  $('btnPrevWeek').addEventListener('click', ()=> goWeek(state.currentWeek-1));
  $('btnNextWeek').addEventListener('click', ()=> goWeek(state.currentWeek+1));
  $('btnThisWeek').addEventListener('click', thisWeekFromDate);
  $('weekInput').addEventListener('change', ()=> goWeek(parseInt($('weekInput').value,10)||1));
  $('weekInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('weekInput').blur(); });

  // 顶部按钮
  $('btnImport').addEventListener('click', ()=>{ resetImportUI(); $('importDlg').showModal(); });
  $('btnAdd').addEventListener('click', ()=> openCourse(null));
  $('btnSettings').addEventListener('click', openSettings);
  $('btnImportEmpty').addEventListener('click', ()=>{ resetImportUI(); $('importDlg').showModal(); });
  $('btnSampleEmpty').addEventListener('click', loadSample);

  // 菜单
  $('btnMenu').addEventListener('click', e=>{ e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', ()=> toggleMenu(false));
  $('menu').addEventListener('click', e=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const act = btn.dataset.act;
    toggleMenu(false);
    if(act==='sample') loadSample();
    else if(act==='export') exportBackup();
    else if(act==='importBackup') $('backupInput').click();
    else if(act==='clear') confirmClear();
    else if(act==='print') window.print();
  });

  // 导入
  document.querySelectorAll('#importTabs .tab').forEach(t=>{
    t.addEventListener('click', ()=> switchImportTab(t.dataset.tab));
  });
  $('btnAnalyzePaste').addEventListener('click', ()=>{
    const text = $('pasteArea').value;
    analyzeText(text, currentSrcMode());
  });
  $('btnAnalyzeFile').addEventListener('click', ()=>{
    const f = $('fileInput').files[0];
    if(!f){ toast('请先选择文件','warn'); return; }
    analyzeFile(f);
  });
  $('fileInput').addEventListener('change', ()=>{
    if($('fileInput').files[0]) analyzeFile($('fileInput').files[0]);
  });
  $('btnConfirmImport').addEventListener('click', confirmImport);
  $('btnCancelImport').addEventListener('click', ()=>{ $('importDlg').close(); resetImportUI(); });

  // 课程编辑
  $('btnSaveCourse').addEventListener('click', saveCourse);
  $('btnDeleteCourse').addEventListener('click', deleteCourse);
  $('btnCancelCourse').addEventListener('click', ()=> $('courseDlg').close());
  $('f_weeks').addEventListener('input', updateWeeksHint);
  document.querySelectorAll('.quickweeks .chip').forEach(ch=>{
    ch.addEventListener('click', ()=>{
      $('f_weeks').value = ch.dataset.w;
      updateWeeksHint();
    });
  });

  // 设置
  $('btnSaveSettings').addEventListener('click', saveSettings);
  $('btnDataSample').addEventListener('click', loadSample);
  $('btnDataExport').addEventListener('click', exportBackup);
  $('btnDataImport').addEventListener('click', ()=> $('backupInput').click());
  $('btnDataClear').addEventListener('click', confirmClear);
  $('backupInput').addEventListener('change', ()=>{
    if($('backupInput').files[0]) importBackupFile($('backupInput').files[0]);
    $('backupInput').value='';
  });

  // 点击遮罩关闭
  ['importDlg','courseDlg','settingsDlg'].forEach(id=>{
    const dlg = $(id);
    dlg.addEventListener('click', e=>{ if(e.target===dlg) dlg.close(); });
  });
}

/* ---------- 启动 ---------- */
load();
bindEvents();
if(state.courses.length===0){ /* 显示空状态 */ }
$('weekInput').max = state.totalWeeks;
bindMapEvents();
bindViewEvents();
renderAll();

/* ===== 视图切换 / 清单视图（手机友好） ===== */
function updateViewSwitch(){
  document.querySelectorAll('#viewSwitch .vs-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===state.uiView));
  const wrap = $('timetableWrap');
  if(wrap) wrap.classList.toggle('list-mode', state.uiView==='list');
}
function periodRangeText(s,e){
  const sp = state.periods[s-1], ep = state.periods[e-1];
  const t0 = sp ? String(sp.time||'').split('-')[0].trim() : '';
  const t1 = ep ? String(ep.time||'').split('-')[1].trim() : '';
  return (t0 && t1) ? (t0+' ~ '+t1) : '';
}
function renderListView(){
  const tt = $('timetable');
  const week = state.currentWeek;
  let html = '<div class="tt-list">';
  for(let d=1; d<=7; d++){
    const cs = state.courses.filter(c=>c.day===d && courseActiveWeeks(c).weeks.includes(week)).sort((a,b)=>a.start-b.start);
    if(!cs.length) continue;
    html += '<div class="list-day"><div class="list-dayname">'+DAY_NAMES[d-1]+'</div>';
    for(const c of cs){
      const pal = PALETTE[(c.color||0) % PALETTE.length];
      const aw = courseActiveWeeks(c);
      const tag = (aw.text && aw.text!=='全周') ? aw.text : '';
      const tr = periodRangeText(c.start, c.end);
      const b = buildingOf(c.location);
      html += '<div class="list-item" data-id="'+esc(c.id)+'" style="background:'+pal.bg+';border-left:5px solid '+pal.edge+'">'
        + '<div class="li-head"><span class="li-name">'+esc(c.name)+'</span><span class="li-slots">第'+c.start+(c.end>c.start? '-'+c.end : '')+'节'+(tr? ' · '+esc(tr) : '')+'</span></div>'
        + (c.location? '<div class="li-loc"><span>📍 '+esc(c.location)+'</span>'+(b? '<button class="btn small li-map" data-b="'+esc(b)+'">🧭 看地图</button>' : '')+'</div>' : '')
        + (tag? '<div class="li-meta">🗓 '+esc(tag)+'</div>' : '')
        + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  tt.innerHTML = html;
  tt.querySelectorAll('.list-item').forEach(el=>{ el.addEventListener('click', ()=> openCourseById(el.dataset.id)); });
  tt.querySelectorAll('.li-map').forEach(el=>{ el.addEventListener('click', ev=>{ ev.stopPropagation(); openMapForBuilding(el.dataset.b); }); });
}
function openMapForBuilding(b){
  if(!b){ toast('这个地点没有楼栋编号，可在地图里手动添加','warn'); return; }
  mapSelectedBld = b;
  openMap();
  pinInfo(b);
}
function bindViewEvents(){
  document.querySelectorAll('#viewSwitch .vs-btn').forEach(b=>{
    b.addEventListener('click', ()=>{ state.uiView = b.dataset.view; save(); renderAll(); });
  });
}

/* ===== 校园地图（交互式标记） ===== */
let mapSelectedBld = '';
function buildingOf(loc){
  if(!loc) return '';
  const m = String(loc).trim().match(/^([A-Za-z]{1,3}\d{1,2})/);
  return m ? m[1].toUpperCase() : '';
}
function distinctBuildings(){
  const s = {};
  for(const c of state.courses){ const b = buildingOf(c.location); if(b) s[b]=1; }
  return Object.keys(s).sort();
}
function setMapInfo(t){ $('mapSelInfo').textContent = t||''; }
function renderMapBuildings(){
  const builds = distinctBuildings();
  const manual = (state.mappins||[]).map(p=>p.label).filter(l=>builds.indexOf(l)<0);
  const all = [...new Set(builds.concat(manual))].sort();
  const box = $('mapBuildings');
  if(!all.length) box.innerHTML = '<p class="help">课表里暂时没有“字母+数字”的楼栋号，可手动添加，如 A3。</p>';
  else box.innerHTML = all.map(b=>'<button class="map-bld'+(b===mapSelectedBld?' sel':'')+'" data-b="'+esc(b)+'">'+esc(b)+'</button>').join('');
  box.querySelectorAll('.map-bld').forEach(el=>el.addEventListener('click', ()=>{
    mapSelectedBld = el.dataset.b; renderMapBuildings();
    setMapInfo('已选 '+mapSelectedBld+'：请在地图上点击该楼的位置');
  }));
}
function renderMapPins(){
  const box = $('mapPins'); box.innerHTML = '';
  (state.mappins||[]).forEach(p=>{
    const el = document.createElement('div');
    el.className = 'map-pin';
    el.style.left = (p.x*100)+'%';
    el.style.top = (p.y*100)+'%';
    el.textContent = p.label;
    el.title = '点击查看该楼课程';
    el.addEventListener('click', ev=>{ ev.stopPropagation(); pinInfo(p.label); });
    box.appendChild(el);
  });
}
function pinInfo(label){
  mapSelectedBld = label; renderMapBuildings();
  const cs = state.courses.filter(c=>buildingOf(c.location)===label);
  if(cs.length){
    setMapInfo(label+' 的课程：' + cs.map(c=>c.name+'（'+DAY_NAMES[c.day-1]+(c.start===c.end? c.start+'节' : c.start+'-'+c.end+'节')+'）').join('；'));
  } else {
    setMapInfo(label+'（手动标记，暂无对应课程）');
  }
}
function openMap(){
  renderMapBuildings(); renderMapPins();
  setMapInfo('先点左侧楼栋，再在地图上点该楼位置');
  $('mapDlg').showModal();
}
function bindMapEvents(){
  $('btnMap').addEventListener('click', openMap);
  $('btnMapAdd').addEventListener('click', ()=>{
    const v = $('mapAddInput').value.trim().toUpperCase();
    if(!v){ toast('请输入楼栋名，如 A3','warn'); return; }
    mapSelectedBld = v; $('mapAddInput').value='';
    renderMapBuildings();
    setMapInfo('已选 '+v+'：请在地图上点击该楼的位置');
  });
  $('btnMapClear').addEventListener('click', ()=>{
    if(!state.mappins || !state.mappins.length){ toast('还没有任何标记','warn'); return; }
    if(!confirm('确定清除全部地图标记吗？')) return;
    state.mappins = []; save(); renderMapPins(); setMapInfo('已清除全部标记');
  });
  $('mapBox').addEventListener('click', ev=>{
    if(ev.target.closest('.map-pin')) return;
    if(!mapSelectedBld){ setMapInfo('请先在左侧点选楼栋，再点地图'); toast('请先点选一个楼栋','warn'); return; }
    const rect = $('mapBox').getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (ev.clientX-rect.left)/rect.width));
    const y = Math.max(0, Math.min(1, (ev.clientY-rect.top)/rect.height));
    if(!state.mappins) state.mappins = [];
    const ex = state.mappins.find(p=>p.label===mapSelectedBld);
    if(ex){ ex.x = x; ex.y = y; toast('已移动 '+mapSelectedBld+' 的标记'); }
    else { state.mappins.push({ label:mapSelectedBld, x, y }); toast('已标记 '+mapSelectedBld); }
    save(); renderMapPins();
  });
}


})();
/* =========================================================
 *  覆写/增强：更稳的周次、单元格、合并时间解析
 * ========================================================= */
function parseWeeksText(s, totalWeeks){
  totalWeeks = totalWeeks || 20;
  const raw = (s==null ? '' : String(s)).trim();
  if(!raw){ return { weeks: range(1,totalWeeks), text:'全周', ok:true }; }
  const alias = raw.replace(/奇数周?/g,'单周').replace(/偶数周?/g,'双周');
  if(!/\d/.test(alias)){
    if(/单/.test(alias) && !/双/.test(alias)) return { weeks: parityWeeks(totalWeeks,1), text:'单周', ok:true };
    if(/双/.test(alias) && !/单/.test(alias)) return { weeks: parityWeeks(totalWeeks,0), text:'双周', ok:true };
    if(/全|每|所有/.test(alias)) return { weeks: range(1,totalWeeks), text:'全周', ok:true };
  }
  let parity = null;
  if(/单/.test(alias) && !/双/.test(alias)) parity = 1;
  else if(/双/.test(alias) && !/单/.test(alias)) parity = 0;
  const clean = alias.replace(/[周星期第节\s（）()\[\]{}]/g,'');
  const nums = [];
  const re = /(\d{1,2})\s*(?:[-~—至～–]\s*(\d{1,2}))?/g;
  let m;
  while((m = re.exec(clean)) !== null){
    let a = parseInt(m[1],10), b = m[2] ? parseInt(m[2],10) : a;
    if(b<a){ const t=a; a=b; b=t; }
    for(let n=a;n<=b;n++){
      if(n<1 || n>totalWeeks) continue;
      if(parity===1 && n%2!==1) continue;
      if(parity===0 && n%2!==0) continue;
      nums.push(n);
    }
  }
  if(nums.length===0 && parity!==null) nums.push(...parityWeeks(totalWeeks,parity));
  const weeks = uniqueSorted(nums);
  if(weeks.length===0) return { weeks:[], text:raw, ok:false, error:'未能识别出有效周次：'+raw };
  const suffix = parity===1 ? '(单)' : (parity===0 ? '(双)' : '');
  return { weeks, text: compressRanges(weeks) + '周' + suffix, ok:true };
}

// 只提取带“节”字样的节次段，避免把教室号当成节次
function findSlotPairs(s){
  if(s==null) return [];
  const segs = String(s).match(/(?:第)?\s*\d{1,2}(?:\s*[、,，]\s*\d{1,2}|\s*[-~—至～–]\s*\d{1,2})*\s*节/g);
  if(!segs) return [];
  const pairs=[];
  for(const sg of segs){ const p = parseSlotRanges(sg); if(p.length) pairs.push(...p); }
  return pairs;
}

function splitCellCourses(cell){
  return String(cell||'').split(/[;；]/).map(x=>x.trim()).filter(Boolean);
}

function splitNameTeacherLocation(text){
  let t = String(text||'')
    .replace(/[|｜@]/g,' ')
    .replace(/[【】\[\]（）()]/g,' ')
    .replace(/[，。、]/g,' ')
    .replace(/\s+/g,' ');
  const tokens = t.split(' ').map(x=>x.trim()).filter(Boolean);
  if(!tokens.length) return { name:'', teacher:'', location:'' };
  const locIdx = tokens.findIndex(tk => isLocationToken(tk) && tk !== tokens[0]);
  let name, teacher='', location='';
  if(locIdx>0){
    location = tokens[locIdx];
    const rest = tokens.filter((_,i)=>i!==locIdx);
    name = rest[0]||'';
    teacher = rest.slice(1).join(' ');
  } else {
    name = tokens[0];
    teacher = tokens.slice(1).join(' ');
  }
  if(name.length<=1 && teacher){ name = (name+' '+teacher).trim(); teacher=''; }
  return { name, teacher, location };
}

function parseMatrixCell(text, colDay, fallbackPairs){
  const weeksText = findWeeksText(text);
  let rest = weeksText ? text.replace(weeksText,'') : text;
  const day = parseDayText(rest) || colDay;
  const restNoDay = rest.replace(/(?:周|星期|礼拜)[一二三四五六日天]/g,' ');
  const restNoSlots = restNoDay.replace(/(?:第)?\s*\d{1,2}(?:\s*[、,，]\s*\d{1,2}|\s*[-~—至～–]\s*\d{1,2})*\s*节/g,' ');
  const pairs = findSlotPairs(restNoDay);
  const usePairs = pairs.length? pairs : fallbackPairs;
  if(!day) return { ok:false, error:'无法识别星期' };
  if(!usePairs.length) return { ok:false, error:'无法识别节次（请确认第 1 列是节次，如 1-2）' };
  const { name, teacher, location } = splitNameTeacherLocation(restNoSlots);
  if(!name) return { ok:false, error:'无法识别课程名称' };
  const pair = usePairs[0];
  return { ok:true, course:{ name, day, start:pair[0], end:pair[1], weeksRaw:weeksText, teacher, location } };
}

function parseCombinedSegments(text){
  const segs = String(text||'').split(/[;；]/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  for(const seg of segs){
    if(!seg) continue;
    const weeksText = findWeeksText(seg);
    const seg2 = weeksText ? seg.replace(weeksText,'') : seg;
    const day = parseDayText(seg2);
    let pairs = findSlotPairs(seg2);
    if(!pairs.length) pairs = parseSlotRanges(seg2.replace(/[A-Za-z]+/g,' '));
    if(day && pairs.length){
      for(const p of pairs) out.push({ day, start:p[0], end:p[1], weeksRaw:weeksText });
    }
  }
  return out;
}
/* 更稳的节次解析：只认“纯数字段”，避免教室号/时间被误判 */
function parseSlotRanges(s){
  if(s==null) return [];
  const cleaned = String(s).replace(/[第节大\s]/g,' ');
  const tokens = cleaned.split(/[^0-9,，\-~—至～–]+/).filter(Boolean);
  const nums=[];
  for(const token of tokens){
    const parts = token.split(/[,，]+/);
    for(const part of parts){
      const m = part.match(/^(\d{1,2})(?:[-~—至～–](\d{1,2}))?$/);
      if(!m) continue;
      let a = parseInt(m[1],10), b = m[2]? parseInt(m[2],10) : a;
      if(b<a){ const t=a; a=b; b=t; }
      if(b>24) continue;
      for(let n=a;n<=b;n++) if(n>=1 && n<=24) nums.push(n);
    }
  }
  const u = uniqueSorted(nums);
  const pairs=[]; if(!u.length) return pairs;
  let st=u[0], prev=u[0];
  for(let i=1;i<u.length;i++){
    if(u[i]===prev+1){ prev=u[i]; }
    else { pairs.push([st,prev]); st=prev=u[i]; }
  }
  pairs.push([st,prev]);
  return pairs;
}

function findWeeksText(s){
  const m = String(s||'').match(WEEKS_PHRASE_RE);
  return m ? m[0].trim() : '';
}

function timeToMin(t){
  if(!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if(!m) return null;
  return (+m[1])*60 + (+m[2]);
}
// 第一列是时间段(如 08:00-09:40)时，用设置里的节次时间反推节次范围
function timeHintPairs(hint, periods){
  const parts = String(hint||'').split('-').map(x=>x.trim());
  if(parts.length<1) return [];
  const sm = timeToMin(parts[0]);
  if(sm==null) return [];
  const em = parts.length>1 ? timeToMin(parts[1]) : null;
  let i=-1, j=-1;
  (periods||[]).forEach((p,idx)=>{
    const seg = String(p.time||'').split('-').map(x=>x.trim());
    if(seg.length<1) return;
    if(timeToMin(seg[0])===sm && i<0) i=idx;
    if(em!=null && seg.length>1 && timeToMin(seg[1])===em) j=idx;
  });
  if(i<0) return [];
  if(j>=i) return [[i+1, j+1]];
  return [[i+1, i+1]];
}

function parseMatrixRows(rows, periods){
  const errs = [];
  const grid = (rows||[]).filter(r=>r && r.some(c=>String(c==null?'':c).trim()));
  if(grid.length<2){ return { ok:false, courses:[], errors:['数据行太少'], meta:{} }; }
  let hIdx=-1, dayCols={};
  for(let i=0;i<Math.min(grid.length,5);i++){
    const found={};
    grid[i].forEach((cell,ci)=>{ const d=parseDay(cell); if(d) found[ci]=d; });
    if(Object.keys(found).length>=2){ hIdx=i; dayCols=found; break; }
  }
  if(hIdx<0){ return { ok:false, courses:[], errors:['没有找到“星期一~星期日”之类的表头行，请把教务网页的整个课表（含表头）复制进来。'], meta:{} }; }
  const colMax = Math.max(...Object.keys(dayCols).map(Number));
  const courses=[];
  for(let ri=hIdx+1; ri<grid.length; ri++){
    const row = grid[ri];
    if(!row || row.every(c=>!String(c==null?'':c).trim())) continue;
    while(row.length<=colMax) row.push('');
    const hintRaw = String(row[0]==null?'':row[0]).trim();
    let fallbackPairs = [];
    if(hintRaw.indexOf(':')>=0) fallbackPairs = periods? timeHintPairs(hintRaw, periods) : [];
    else fallbackPairs = parseSlotRanges(hintRaw);
    for(const ciStr of Object.keys(dayCols)){
      const ci = Number(ciStr);
      const dayCol = dayCols[ci];
      const cell = String(row[ci]==null?'':row[ci]).trim();
      if(!cell) continue;
      const segs = splitCellCourses(cell);
      for(const seg of segs){
        const cand = parseMatrixCell(seg, dayCol, fallbackPairs);
        if(cand.ok) courses.push(cand.course);
        else errs.push('第'+(ri+1)+'行 ' + DAY_NAMES[dayCol-1] + '：' + cand.error);
      }
    }
  }
  return { ok:true, courses, errors:errs, meta:{mode:'matrix'} };
}
/* 支持“多个空格”作为列分隔符（从网页复制表格常见） */
function detectDelimiter(text){
  const lines = String(text||'').split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return '\t';
  const cands = ['\t',',','，','|',';','；','__SPACES__'];
  let best='\t', bestScore=0;
  for(const d of cands){
    let score=0; const counts=[];
    for(let i=0;i<Math.min(lines.length,8);i++){
      const re = (d==='__SPACES__') ? /\s{2,}/g : new RegExp(escRe(d),'g');
      const cnt=(lines[i].match(re)||[]).length;
      if(cnt>0) score+=cnt;
      counts.push(cnt);
    }
    const nonZero = counts.filter(c=>c>0);
    if(nonZero.length>=2 && new Set(nonZero).size===1) score += nonZero[0]*2;
    if(score>bestScore){ bestScore=score; best=d; }
  }
  return best;
}
function splitLine(line, delim){
  if(delim==='__SPACES__') return line.split(/\s{2,}/).map(x=>x.trim());
  if(delim !== ',') return line.split(delim);
  const out=[]; let cur='', q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){
      if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; }
      else cur+=ch;
    } else {
      if(ch==='"') q=true;
      else if(ch===','){ out.push(cur); cur=''; }
      else cur+=ch;
    }
  }
  out.push(cur);
  return out;
}
function parseDelimitedRows(text){
  const delim = detectDelimiter(text);
  const rows = String(text||'').split(/\r?\n/).map(l=>l.trimEnd())
    .filter(l=>l.trim().length>0)
    .map(l=>splitLine(l, delim).map(c=>String(c||'').trim()));
  return { delim, rows };
}