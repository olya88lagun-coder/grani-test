/* Static visual prototype. All accounts and answers are fictional; no network requests. */
(() => {
'use strict';
const catalog = window.stage2Catalog;
const root = document.querySelector('#stage2');
const tools = document.querySelector('#reviewTools');
const dialog = document.querySelector('#stage2Dialog');
const notice = document.querySelector('#stage2Notice');
const scenarios = {
 answer:'Ответ', 'partner-ready':'Партнёр уже ответил', waiting:'Ожидание', revealed:'Раскрытие',
 edited:'Ответ изменён', skipped:'Партнёр пропустил', 'skipped-own':'Собственный пропуск',
 locked:'Нужна оплата', 'payment-check':'Проверка оплаты', 'after-payment':'После оплаты',
 history:'История', 'history-empty':'История пуста', 'history-more':'Длинная история',
 complete:'Маршрут завершён', loading:'Загрузка', unavailable:'Пространство недоступно',
 'network-error':'Ошибка сети', 'rate-limit':'Слишком много запросов'
};
let data, actor = 0, scenario = 'answer', page = 'card', historyLimit = 20, error = '', busy = false;
let drafts = {}, doneDrafts = {}, receipt = null, paidNotice = false, special = '', failNext = '', editingId = null;
window.stage2Requests = [];
const names = ['Анна', 'Алексей'];
const answerSamples = [
 ['Ты оставил мне завтрак и записку перед ранним созвоном. Я почувствовала, что ты рядом, даже в обычное утро.',
  'Ты встретила меня после трудного дня и предложила пройтись без телефонов. Это было очень вовремя.'],
 ['Мне хочется полчаса прогуляться с тобой после работы. Можно без планов и без телефона.',
  'Обнять друг друга утром и спокойно позавтракать вместе в выходной.'],
 ['Наша первая прогулка у реки. Мы так увлеклись разговором, что прошли мимо нужной остановки.',
  'Вечер, когда мы готовили ужин и забыли поставить таймер. Зато очень много смеялись.']
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other = () => 1-actor;
const idOf = i => '00000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
function blank(i) { return {id:idOf(i), position:i+1, snapshot:catalog[i], answers:[null,null], skippedBy:null, seen:[false,false], done:[false,false]}; }
function closed(c) { return c.skippedBy !== null || c.answers.every(Boolean); }
function sample(i,a) { return answerSamples[i]?.[a] ?? (a ? 'Мне приятно, когда у нас есть спокойное время вместе. Давай выберем удобный момент.' : 'Хочу попробовать маленькое действие без спешки. Давай обсудим, что будет удобно нам обоим.'); }
function fill(c,a,text=sample(c.position-1,a)) { c.answers[a] = {fields:{answer:text}, revision:1}; }
function ensureNext() { const last=data.cards.at(-1); if(last && closed(last) && last.position<catalog.length) data.cards.push(blank(last.position)); }
function current() {
 if(receipt && receipt.actor===actor) return data.cards.find(c=>c.id===receipt.id);
 return data.cards.find(c=>closed(c)&&!c.seen[actor]) ?? data.cards.find(c=>!closed(c)) ?? null;
}
function stateOf(c) { return c.skippedBy !== null ? 'skipped' : closed(c) ? 'revealed' : c.answers[actor] ? 'waiting' : 'answer'; }
function locked(c) { return c.snapshot.kind==='main' && stateOf(c)==='answer' && !data.access; }
function view(c) {
 const revealed=stateOf(c)==='revealed', mine=c.answers[actor], theirs=c.answers[other()];
 const partner={status:c.skippedBy===other()?'skipped':theirs?'answered':'none'};
 if(revealed && theirs) Object.assign(partner,{fields:theirs.fields,edited:theirs.revision>1,done:c.done[other()]});
 return {...c.snapshot,id:c.id,position:c.position,state:stateOf(c),locked:locked(c),
  mine:mine?{fields:mine.fields,revision:mine.revision,done:c.done[actor]}:null,partner};
}
function progress(){return {done:data.cards.filter(closed).length,total:catalog.length};}
function record(method,path,body) { const r={method,path};if(body!==undefined)r.body=structuredClone(body);window.stage2Requests.push(r); }
function say(text){notice.textContent=text;}
function seedClosed(n) {
 data.cards=[];
 for(let i=0;i<n;i++){const c=blank(i);fill(c,0);fill(c,1);c.seen=[true,true];
  if(i===1){c.skippedBy=1;c.answers[1]=null;}
  if(i===0)c.answers[1].revision=2;
  data.cards.push(c);
 }
 if(n<catalog.length)data.cards.push(blank(n));
}
function setScenario(s) {
 if(!scenarios[s])s='answer';
 scenario=s; actor=0; page='card';historyLimit=20;error='';busy=false;drafts={};doneDrafts={};receipt=null;paidNotice=false;special='';failNext='';editingId=null;
 dialog.close(); data={access:false,cards:[blank(0)]};window.stage2Requests=[];
 if(s==='partner-ready')fill(data.cards[0],1);
 if(s==='waiting')fill(data.cards[0],0);
 if(['revealed','edited'].includes(s)){
  fill(data.cards[0],0);fill(data.cards[0],1);
  if(s==='edited'){data.cards[0].answers[1].revision=2;data.cards[0].done[1]=true;}
  ensureNext();
 }
 if(['skipped','skipped-own'].includes(s)){
  const c=data.cards[0];fill(c,0);c.skippedBy=s==='skipped'?1:0;c.seen[c.skippedBy]=true;
  if(s==='skipped-own'){c.answers[0]=null;fill(c,1);receipt={id:c.id,actor:0};}
  ensureNext();
 }
 if(['locked','payment-check','after-payment'].includes(s)){
  seedClosed(3); data.access=s==='after-payment';paidNotice=s==='after-payment';
  if(s==='payment-check')special='payment-check';
 }
 if(['history','history-more'].includes(s)){seedClosed(s==='history'?3:23);data.access=true;page='history';}
 if(s==='history-empty')page='history';
 if(s==='complete'){seedClosed(catalog.length);data.access=true;}
 if(['loading','unavailable'].includes(s))special=s;
 if(s==='network-error')error='Ответ не отправлен. Проверьте соединение и попробуйте ещё раз. Текст остался здесь.';
 if(s==='rate-limit')error='Слишком много запросов. Подождите немного и повторите действие.';
 if(['network-error','rate-limit'].includes(s))drafts[data.cards[0].id]={answer:'Мне было приятно, когда ты приготовил мне чай.'};
 history.replaceState(null,'','#'+s);render();renderTools();
}
const symbols = {
 pair:'<svg viewBox="0 0 100 85" fill="none" aria-hidden="true"><ellipse cx="39" cy="42" rx="26" ry="33" stroke="currentColor" stroke-width="1"/><ellipse cx="61" cy="42" rx="26" ry="33" stroke="currentColor" stroke-width="1"/><path d="M38 42h24M50 30v24" stroke="currentColor" stroke-width=".6"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z" stroke="currentColor" stroke-width="1.1"/></svg>',
 skip:'<svg viewBox="0 0 90 70" fill="none" aria-hidden="true"><path d="M13 20h52v34H13zM26 12h52v34M24 36h29M44 27l10 9-10 9" stroke="currentColor" stroke-width="1.2"/></svg>'
};
function button(label,action,cls='btn',attrs='') {return '<button type="button" class="'+cls+'" data-action="'+action+'" '+attrs+'>'+label+'</button>';}
function errorBox(){return error?'<div class="s2-error" role="alert">'+esc(error)+'</div>':'';}
function header(){return '<header class="wrap site-head s2-header"><a class="brand" href="./index.html"><svg class="logo" viewBox="0 0 32 35" fill="none" aria-hidden="true"><path d="M16 2 30 11v15l-14 7L2 26V11zM16 2v31M2 11l14 8 14-8M2 26l14-7 14 7" stroke="currentColor"/></svg>Грани<span class="brand-divider"></span><span class="brand-sub">ВДВОЁМ</span></a>'+(special==='unavailable'?'':'<nav class="site-nav" aria-label="Раздел"><div class="s2-person"><div class="s2-avatars" aria-hidden="true"><span>А</span><span>А</span></div><strong>'+esc(names[0])+' и '+esc(names[1])+'</strong></div></nav>')+'</header>';}
function aside() {
 const p=progress();
 return '<aside class="s2-sidebar"><section class="s2-progress" aria-label="Прогресс"><span class="eyebrow">Ваш маршрут</span><strong>'+p.done+' <small>из '+p.total+' карточек</small></strong><progress value="'+p.done+'" max="'+p.total+'" aria-label="Закрыто '+p.done+' из '+p.total+' карточек"></progress><p>Раскрытые и пропущенные карточки входят в прогресс. Темп выбираете вы.</p>'+button(page==='history'?'К текущей карточке':'История карточек',page==='history'?'card':'history','text-link')+'</section><section class="s2-sidebar-note"><div class="s2-side-art">'+symbols.pair+'</div><span class="eyebrow">Без спешки</span><h3>В удобный момент</h3><p>Ответьте отдельно. Когда ответят оба, можно прочитать ответы вместе и попробовать маленький шаг.</p></section></aside>';
}
function banner(){return paidNotice?'<div class="s2-banner" role="status"><span class="s2-dot"></span><p><strong>Доступ открыт для вас двоих.</strong><br>Продолжайте с этой карточки. Ваши вводные ответы сохранены.</p></div>':'';}
function cardHead(v,label){return '<div class="s2-card-head"><span>'+(v.kind==='intro'?'Знакомство':'Больше внимания')+' · карточка '+v.position+'</span><span class="pill">'+label+'</span></div><h2>'+esc(v.title)+'</h2><p class="s2-question">'+esc(v.prompt)+'</p><p class="s2-hint">'+esc(v.hint)+' · Около '+esc(v.estimatedMinutes)+' минут</p>';}
function answerForm(v,edit=false) {
 const f=v.fields.find(x=>x.id==='answer');const text=drafts[v.id]?.answer ?? v.mine?.fields.answer ?? '';
 const extras=v.fields.filter(x=>x.type==='short_text'&&x.id!=='answer').map(x=>{
  const value=drafts[v.id]?.[x.id] ?? v.mine?.fields[x.id] ?? '';
  return '<div><label class="s2-label" for="field-'+esc(x.id)+'">'+esc(x.label)+(x.required?'':' · Необязательно')+'</label><textarea class="s2-textarea s2-extra" id="field-'+esc(x.id)+'" data-field="'+esc(x.id)+'" maxlength="'+x.maxLength+'" '+(x.required?'required':'')+'>'+esc(value)+'</textarea></div>';
 }).join('');
 return '<form class="s2-form" id="answerForm" data-card="'+v.id+'"><div><label class="s2-label" for="answerInput">Ваш ответ</label><textarea class="s2-textarea" id="answerInput" name="answer" data-field="answer" required maxlength="'+f.maxLength+'" aria-describedby="answerHint answerCount" placeholder="Можно написать несколько предложений">'+esc(text)+'</textarea><span class="s2-count" id="answerCount">'+text.length+' / '+f.maxLength+'</span></div>'+extras+'<p class="s2-privacy" id="answerHint">'+symbols.lock+'<span>'+(edit ? 'Партнёр увидит обновлённый текст с отметкой «изменено».' : 'Ответы откроются, когда ответят оба. До этого партнёр видит только статус.')+'</span></p><div class="s2-actions"><button type="submit" class="btn">'+(edit?'Сохранить изменения':'Отправить ответ')+'</button>'+button(edit?'Отменить':'Пропустить карточку',edit?'cancel-edit':'skip-confirm','text-link')+'</div></form>';
}
function own(v,privateAnswer=false) {
 return '<div class="s2-paper s2-own"><div class="s2-answer-heading"><strong>Ваш ответ</strong><span class="s2-meta">'+(privateAnswer?'Только вам':'Отправлен')+'</span></div><blockquote class="s2-answer-text">'+esc(v.mine.fields.answer)+'</blockquote>'+(privateAnswer?'': '<div class="s2-actions">'+button('Изменить ответ','edit','text-link')+button('Удалить ответ','delete-confirm','text-link')+'</div>')+'</div>';
}
function reply(v,isMine) {
 const a=isMine?v.mine:v.partner;
 const name=isMine?'Ваш ответ':names[other()];
 const edited=isMine?(v.mine.revision>1):v.partner.edited;
 let body='<section class="s2-paper"><div class="s2-answer-heading"><strong>'+esc(name)+'</strong>'+(edited?'<span class="s2-meta">изменено</span>':'')+'</div><blockquote class="s2-answer-text">'+esc(a.fields.answer)+'</blockquote>';
 body+=v.fields.filter(f=>f.type==='short_text'&&f.id!=='answer'&&a.fields[f.id]).map(f=>'<div class="s2-extra-answer"><p class="s2-meta">'+esc(f.label)+'</p><p>'+esc(a.fields[f.id])+'</p></div>').join('');
 if(isMine){body+=button('Изменить ответ','edit','text-link');
  const bools=v.fields.filter(f=>f.type==='boolean'&&f.availableAt==='after_reveal');
  body+=bools.map(f=>'<div class="s2-selection"><label class="s2-check"><input type="checkbox" data-after-reveal="'+esc(f.id)+'" '+(a.fields[f.id]?'checked':'')+'><span>'+esc(f.label)+'</span></label>'+(f.id==='share_in_book'?'<p class="s2-meta">Это ваш выбор для будущей книги.</p>':'')+'</div>').join('');
 }
 return body+'</section>';
}
function renderCard() {
 const c=current();
 if(!c)return '<section class="s2-empty"><span class="eyebrow">29 карточек позади</span><h2>Вы прошли этот маршрут</h2><p>В истории остались ваши ответы и пропуски. Можно вернуться к любому раскрытому вопросу.</p>'+button('Открыть историю','history')+'</section>';
 const v=view(c);
 if(editingId===v.id && ['waiting','revealed'].includes(v.state))return '<section class="s2-card" data-state="'+v.state+'">'+cardHead(v,'Редактирование')+answerForm(v,true)+errorBox()+'</section>';
 let content=banner()+'<section class="s2-card" data-state="'+v.state+'" data-locked="'+v.locked+'">';
 const label=v.locked?'После оплаты':v.state==='answer'?'Ваш ответ':v.state==='waiting'?'Ответ отправлен':v.state==='revealed'?'Ответы раскрыты':'Пропущено';
 content+=cardHead(v,label);
 if(v.locked)content+='<div class="s2-locked"><h3>Продолжите вдвоём</h3><p>Три вводные карточки доступны бесплатно. Чтобы отвечать на основной маршрут, откройте доступ для пары.</p><div class="s2-price">599 ₽ <small>за пару · 30 дней</small></div>'+button('Открыть доступ','payment')+'<p class="s2-meta">Оплачивает один из вас. Без автоматического продления.<br>Карточка останется здесь до оплаты.</p></div>';
 else if(v.state==='answer')content+='<div class="s2-status" style="margin-top:20px"><span class="s2-dot"></span>'+(v.partner.status==='answered'?esc(names[other()])+' уже ответил'+(other()===0?'а':'')+'. Ответ скрыт.':'Ответьте в удобный момент')+'</div>'+answerForm(v);
 else if(v.state==='waiting')content+='<div class="s2-wait">'+symbols.pair+'<div><h3>Ваш ответ на месте</h3><p>Когда '+esc(names[other()])+' ответит, здесь откроются оба ответа. Можно вернуться позже.</p></div></div>'+own(v)+'<div class="s2-actions">'+button('Проверить ответы','refresh','btn secondary')+button('Пропустить карточку','skip-confirm','text-link')+'</div><p class="s2-hint" style="margin-top:12px">Пропуск закроет карточку для обоих. Ответы не раскроются.</p>';
 else if(v.state==='revealed'){
  content+='<div class="s2-replies">'+reply(v,true)+reply(v,false)+'</div><section class="s2-step"><span class="eyebrow">Маленький шаг</span><h3>Попробуйте вместе</h3><p>'+esc(v.jointAction)+'</p><label class="s2-check"><input id="doneInput" type="checkbox" '+((doneDrafts[v.id]??v.mine.done)?'checked':'')+' '+(v.mine.done?'disabled':'')+'><span>Сделали вместе</span></label><p class="s2-meta">'+(v.partner.done?esc(names[other()])+' уже отметил'+(other()===0?'а':'')+' этот шаг.':'Отметка необязательна. Она сохранится после «Продолжить».')+'</p></section><div class="s2-bottom"><p>Можно двигаться дальше, даже если попробуете этот шаг позже.</p>'+button('Продолжить','continue')+'</div>';
 } else {
  content+='<div class="s2-paper s2-skipped"><div class="s2-icon">'+symbols.skip+'</div><span class="eyebrow">Можно идти дальше</span><h3>Карточка пропущена</h3><p>'+(c.skippedBy===actor?'Вы пропустили этот вопрос.':'Партнёр пропустил этот вопрос.')+' Карточка закрыта для вас обоих. Ответы друг другу не откроются.</p></div>'+(v.mine?own(v,true):'')+'<div class="s2-bottom"><p>Пропуск входит в прогресс. Возвращаться к ответу на эту карточку нельзя.</p>'+button('Продолжить','continue')+'</div>';
 }
 return content+errorBox()+'</section>';
}
function historyItems(){return data.cards.filter(closed).sort((a,b)=>b.position-a.position);}
function renderHistory() {
 const items=historyItems();if(!items.length)return '<section class="s2-empty"><span class="eyebrow">Всё начинается с одного ответа</span><h2>История ещё впереди</h2><p>Здесь появятся раскрытые и пропущенные карточки. Незавершённый вопрос остаётся текущим.</p>'+button('К текущей карточке','card')+'</section>';
 return '<section aria-label="История карточек"><p class="s2-history-caption">Новые карточки сверху. В пропущенных виден только ваш ответ, если он был.</p><div class="s2-history">'+items.slice(0,historyLimit).map(c=>{
  const v=view(c);return '<button type="button" class="s2-history-item" data-history="'+c.id+'"><span class="s2-history-meta"><span>Карточка '+c.position+'</span><span>'+ (v.state==='revealed'?'Раскрыто':'Пропущено')+'</span></span><h2>'+esc(v.title)+'</h2><p>'+esc(v.prompt)+'</p><span class="s2-history-read">'+(v.state==='revealed'?'Прочитать ответы':'Посмотреть итог')+'</span></button>';
 }).join('')+(items.length>historyLimit?button('Показать предыдущие','more','btn secondary s2-more'):'')+'</div>'+errorBox()+'</section>';
}
function specialScreen(){
 if(special==='unavailable')return '<section class="s2-empty"><span class="eyebrow">Совместное пространство</span><h2>Пространство недоступно</h2><p>Не удалось открыть совместные карточки. Вернитесь в раздел «Вдвоём», чтобы проверить участие.</p><a class="btn" href="./stage1.html">В раздел «Вдвоём»</a></section>';
 if(special==='payment-check')return '<section class="s2-card s2-loading"><div class="s2-icon">'+symbols.lock+'</div><h2>Проверяем оплату</h2><p>Платёж может подтверждаться несколько минут.<br>Карточка останется на прежнем месте. Не оплачивайте повторно.</p>'+button('Проверить доступ','verify-payment','btn secondary')+errorBox()+'</section>';
 return '<section class="s2-card s2-loading" aria-busy="true"><span class="eyebrow">Вопрос для двоих</span><div class="s2-rule"></div><h2>Открываем карточку</h2><p>Получаем текущий вопрос и сохранённый прогресс.</p></section>';
}
function render({focus=false}={}) {
 const p=progress(), available=special!=='unavailable';
 root.innerHTML=header()+'<main class="wrap s2-main"><div class="s2-top"><div><span class="eyebrow">'+(available?'Ваше пространство':'Вдвоём')+'</span><h1 tabindex="-1">'+(page==='history'?'История ваших карточек':'Вопрос для двоих')+'</h1></div><p class="small muted">'+(page==='history'?'Ответы, к которым можно вернуться.':'Небольшой разговор. Один общий момент.')+'</p></div>'+(available?'<div class="s2-mobile-progress"><span>'+p.done+' из '+p.total+' карточек</span><progress value="'+p.done+'" max="'+p.total+'" aria-label="Закрыто '+p.done+' из '+p.total+' карточек"></progress></div>':'')+'<div class="s2-layout '+(available?'':'s2-single')+'"><div>'+ (special?specialScreen():page==='history'?renderHistory():renderCard())+'</div>'+(available?aside():'')+'</div></main><footer class="wrap s2-footer">Грани. Вдвоём · В своём темпе, с вниманием друг к другу</footer>';
 if(focus)root.querySelector('h1').focus({preventScroll:true});
}
function renderTools(){
 tools.innerHTML='<label>Экран макета<select id="scenarioInput">'+Object.entries(scenarios).map(([key,label])=>'<option value="'+key+'" '+(scenario===key?'selected':'')+'>'+label+'</option>').join('')+'</select></label><div class="row">'+names.map((n,i)=>button('Смотреть как '+n,'actor-'+i,'','aria-pressed="'+(actor===i)+'"')).join('')+'</div>'+button('Партнёр ответил','demo-answer','')+button('Партнёр пропустил','demo-skip','')+button('Подтвердить оплату','demo-paid','')+'<label>Ошибка следующего действия<select id="failInput"><option value="">Без ошибки</option>'+['network','400 invalid_field','400 field_not_available','400 invalid','401','403','404','409 already_closed','409 already_revealed','409 reveal_pending','409 access_required','409 skip_not_allowed','409 not_closed','429'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><p class="s2-test-help">Управление демонстрацией. Ответы вымышленные. Переключатели, имена и имитация запросов не входят в продукт.</p>';
}
const errorMessages = {
 network:'Действие не подтверждено. Проверьте соединение и повторите попытку. Ваш текст остался здесь.',
 '400 invalid_field':'Проверьте ответ: поле заполнено неверно или текст превышает допустимую длину.',
 '400 field_not_available':'Это поле доступно после раскрытия. Обновите карточку и попробуйте ещё раз.',
 '400 invalid':'Не удалось выполнить действие. Обновите карточку и повторите попытку.',
 '401':'Войдите через VK ID, чтобы продолжить. После входа вернитесь к этой карточке.',
 '403':'Запрос отклонён. Обновите страницу и повторите действие.',
 '409 already_closed':'Карточка уже закрыта. Обновите её, чтобы увидеть итог.',
 '409 already_revealed':'Ответы уже раскрыты. Обновите карточку. Удалить раскрытый ответ нельзя.',
 '409 reveal_pending':'Сначала посмотрите итог предыдущей карточки и нажмите «Продолжить».',
 '409 access_required':'Для этого действия нужен оплаченный доступ. Карточка осталась на месте.',
 '409 skip_not_allowed':'Эту карточку нельзя пропустить.',
 '409 not_closed':'Карточка ещё не закрыта. Дождитесь ответа партнёра или пропустите вопрос.',
 '429':'Слишком много запросов. Подождите немного и повторите действие.'
};
async function mutation(method,path,body,success) {
 if(busy)return;busy=true;record(method,path,body);
 const controls=[...root.querySelectorAll('button,input,textarea'),...dialog.querySelectorAll('button,input,textarea')];
 controls.forEach(x=>x.disabled=true);root.setAttribute('aria-busy','true');
 await new Promise(r=>setTimeout(r,160));
 const fail=failNext;failNext='';document.querySelector('#failInput').value='';busy=false;root.removeAttribute('aria-busy');
 if(fail){error=errorMessages[fail]??'Пространство недоступно.';
  if(fail==='404'){dialog.close();special='unavailable';drafts={};doneDrafts={};receipt=null;data.cards=[];}
  if(fail==='409 access_required')data.access=false;
  if(dialog.open){const note=document.createElement('p');note.className='s2-error';note.setAttribute('role','alert');note.textContent=error;dialog.append(note);controls.forEach(x=>x.disabled=false);}
  else render();
  say(error);return;
 }
 error='';const focusNext=success();render({focus:focusNext===true});say('Действие сохранено в демонстрации.');
}
function openDialog(html){dialog.innerHTML=html;dialog.showModal();}
function closeDialog(){dialog.close();}
function openHistory(id) {
 const c=data.cards.find(c=>c.id===id);if(!c)return;
 const v=view(c);
 const revealed=v.state==='revealed';
 openDialog('<span class="eyebrow">Карточка '+v.position+' · '+(revealed?'Раскрыто':'Пропущено')+'</span><h2 id="dialogTitle">'+esc(v.title)+'</h2><p class="s2-hint">'+esc(v.prompt)+'</p>'+
 (revealed?'<div class="s2-replies"><section class="s2-paper"><div class="s2-answer-heading"><strong>Ваш ответ</strong>'+(v.mine.revision>1?'<span class="s2-meta">изменено</span>':'')+'</div><blockquote class="s2-answer-text">'+esc(v.mine.fields.answer)+'</blockquote>'+(v.mine.fields.share_in_book?'<p class="s2-meta">Выбран вами для будущей книги</p>':'')+'</section><section class="s2-paper"><div class="s2-answer-heading"><strong>'+esc(names[other()])+'</strong>'+(v.partner.edited?'<span class="s2-meta">изменено</span>':'')+'</div><blockquote class="s2-answer-text">'+esc(v.partner.fields.answer)+'</blockquote></section></div>':
 '<p class="s2-hint">Карточка пропущена. Ответы не раскрываются.</p>'+(v.mine?own(v,true):'<p class="s2-hint">Вашего сохранённого ответа нет.</p>'))+
 '<div class="s2-actions">'+button('Закрыть','close','btn secondary')+'</div>');
}
function afterRevealFields(c){return c.snapshot.fields.filter(f=>f.type==='boolean'&&f.availableAt==='after_reveal');}
root.addEventListener('input',e=>{
 if(e.target.dataset.field){const c=current();drafts[c.id]??={};drafts[c.id][e.target.dataset.field]=e.target.value;if(e.target.id==='answerInput')root.querySelector('#answerCount').textContent=e.target.value.length+' / '+e.target.maxLength;}
});
root.addEventListener('change',e=>{
 const c=current();if(!c)return;
 if(e.target.id==='doneInput'){doneDrafts[c.id]=e.target.checked;return;}
 const key=e.target.dataset.afterReveal;if(!key)return;
 if(stateOf(c)!=='revealed')return;
 const was=!!c.answers[actor].fields[key], checked=e.target.checked;
 const fields={...c.answers[actor].fields,[key]:checked};
 mutation('PUT','/api/together/cards/'+c.id+'/answer',{fields},()=>{c.answers[actor].fields=fields;});
 // The render after a failed mutation restores the server value.
 e.target.setAttribute('data-previous',String(was));
});
root.addEventListener('submit',e=>{
 if(e.target.id!=='answerForm')return;e.preventDefault();const c=current();
 if(!c||locked(c)||stateOf(c)==='skipped')return;
 const input=root.querySelector('#answerInput'), value=input.value.trim();
 if(!value || /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)){
  error='Напишите ответ без недопустимых символов.';render();root.querySelector('#answerInput').focus();return;
 }
 const revealed=stateOf(c)==='revealed';
 const fields=revealed?{...c.answers[actor].fields,answer:value}:{answer:value};
 root.querySelectorAll('#answerForm [data-field]').forEach(input=>{if(input.value.trim()||input.dataset.field==='answer')fields[input.dataset.field]=input.value.trim();else delete fields[input.dataset.field];});
 // BEFORE reveal, no after_reveal field is sent, even false.
 if(!revealed)afterRevealFields(c).forEach(f=>delete fields[f.id]);
 mutation('PUT','/api/together/cards/'+c.id+'/answer',{fields},()=>{
  const old=c.answers[actor], textChanged=old&&c.snapshot.fields.filter(f=>f.type==='short_text').some(f=>(old.fields[f.id]??'')!==(fields[f.id]??''));
  c.answers[actor]={fields,revision:old?old.revision+(revealed&&textChanged?1:0):1};
  delete drafts[c.id];editingId=null;closeDialog();
  if(closed(c))ensureNext();
 });
});
function handleAction(action){
 const c=current(),v=c?view(c):null;
 if(action==='close'){closeDialog();return;}
 if(action==='history'){page='history';special='';record('GET','/api/together/history');render({focus:true});return;}
 if(action==='card'){page='card';render({focus:true});return;}
 if(action==='more'){const items=historyItems();const before=items[historyLimit-1]?.position;record('GET','/api/together/history?before='+before);historyLimit+=20;render();return;}
 if(action==='refresh'){record('GET','/api/together/cards/current');error='';render();say(v?.state==='waiting'?'Ответ партнёра ещё не получен.':'Карточка обновлена.');return;}
 if(action==='payment'){special='payment-check';render({focus:true});return;}
 if(action==='verify-payment'){record('GET','/api/together/space');if(data.access){special='';paidNotice=true;}else error='Подтверждение доступа ещё не получено. Повторная оплата не нужна.';render();return;}
 if(!c)return;
 if(action==='skip-confirm' && !v.locked && ['answer','waiting'].includes(v.state))openDialog('<h2 id="dialogTitle">Пропустить для обоих?</h2><p>Карточка закроется. Ответы не раскроются. Если партнёр уже ответил, его текст останется только у него. Ваш отправленный ответ будет удалён.</p><div class="s2-actions">'+button('Оставить карточку','close','btn secondary')+button('Пропустить','skip')+'</div>');
 if(action==='skip' && !v.locked && ['answer','waiting'].includes(v.state))mutation('POST','/api/together/cards/'+c.id+'/skip',undefined,()=>{
  c.skippedBy=actor;c.answers[actor]=null;c.seen[actor]=true;receipt={id:c.id,actor};delete drafts[c.id];ensureNext();closeDialog();
 });
 if(action==='continue'&&closed(c))mutation('POST','/api/together/cards/'+c.id+'/continue',v.state==='revealed'&&doneDrafts[c.id]?{done:true}:{},()=>{
  c.seen[actor]=true;if(doneDrafts[c.id]&&v.state==='revealed')c.done[actor]=true;receipt=null;paidNotice=false;return true;
 });
 if(action==='edit'&&v.mine&&['waiting','revealed'].includes(v.state)){
  // Same inline editor keeps the original snapshot and field metadata.
  editingId=v.id;render();
  root.querySelector('#answerInput').focus();
 }
 if(action==='cancel-edit'){delete drafts[c.id];editingId=null;error='';render();}
 if(action==='delete-confirm'&&v.state==='waiting')openDialog('<h2 id="dialogTitle">Удалить свой ответ?</h2><p>До раскрытия можно удалить отправленный ответ. Карточка останется открытой, и вы сможете ответить снова.</p><div class="s2-actions">'+button('Оставить ответ','close','btn secondary')+button('Удалить ответ','delete')+'</div>');
 if(action==='delete'&&v.state==='waiting')mutation('DELETE','/api/together/cards/'+c.id+'/answer',undefined,()=>{c.answers[actor]=null;delete drafts[c.id];closeDialog();});
}
root.addEventListener('click',e=>{const h=e.target.closest('[data-history]');if(h){openHistory(h.dataset.history);return;}const b=e.target.closest('[data-action]');if(b)handleAction(b.dataset.action);});
dialog.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)handleAction(b.dataset.action);});
dialog.addEventListener('close',()=>{dialog.innerHTML='';});
tools.addEventListener('change',e=>{if(e.target.id==='scenarioInput')setScenario(e.target.value);if(e.target.id==='failInput')failNext=e.target.value;});
tools.addEventListener('click',e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action.startsWith('actor-')){actor=Number(action.slice(-1));error='';editingId=null;render();renderTools();return;}
 const c=current();if(action==='demo-paid'){data.access=true;special='';paidNotice=true;page='card';render();return;}
 if(!c||closed(c))return;
 if(action==='demo-answer'){fill(c,other());if(closed(c))ensureNext();render();say('Партнёр ответил в демонстрации.');}
 if(action==='demo-skip' && !locked(c)){c.skippedBy=other();c.answers[other()]=null;c.seen[other()]=true;ensureNext();render();}
});
window.stage2Demo={
 setScenario, view:()=>current()?structuredClone(view(current())):null, progress,
 setName:(i,n)=>{names[i]=n;render();renderTools();},
 setOwnText:text=>{const c=current();if(!c)return;if(c.answers[actor])c.answers[actor].fields.answer=text;else drafts[c.id]={answer:text};render();},
 refresh:()=>handleAction('refresh')
};
setScenario(location.hash.slice(1)||'answer');
})();
