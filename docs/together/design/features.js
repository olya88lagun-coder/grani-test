(() => {
'use strict';
const params=new URLSearchParams(location.search);
const valid=['home','guess','date','surprise','wishes','letter','tradition'];
let screen=valid.includes(params.get('screen'))?params.get('screen'):'home';
let actor=params.get('actor')==='alexey'?'alexey':'anna';
const names={anna:'Анна',alexey:'Алексей'},other=()=>actor==='anna'?'alexey':'anna';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=(type,cls='art')=>{
const shapes={
guess:'<rect x="23" y="28" width="67" height="93" rx="7" transform="rotate(-9 23 28)"/><rect x="78" y="30" width="67" height="93" rx="7" transform="rotate(8 78 30)"/><path d="M45 65c0-15 22-15 22-2 0 9-10 9-10 17m0 8v2M102 65c0-15 22-15 22-2 0 9-10 9-10 17m0 8v2"/>',
date:'<rect x="15" y="36" width="135" height="85" rx="5"/><path d="m17 39 65 43 65-43M17 118l43-37m88 37-43-37"/><circle cx="82" cy="84" r="15"/><path d="M76 82c-7-8 7-13 6-4 8-9 15 3 0 12z"/>',
surprise:'<path d="M29 63h103v63H29zM22 48h117v20H22zM80 49v77"/><path d="M80 49C33 51 40 16 58 26c10 6 22 23 22 23zm0 0c47 2 40-33 22-23C92 32 80 49 80 49z"/>',
wishes:'<circle cx="62" cy="73" r="39"/><circle cx="101" cy="73" r="39"/><path d="m70 74 9 10 17-24"/><path d="m17 24 3-7 3 7 7 3-7 3-3 7-3-7-7-3zm127 92 2-6 2 6 6 2-6 2-2 6-2-6-6-2"/>',
letter:'<path d="M33 21h76l20 20v91H33zM109 21v20h20M50 60h61M50 75h61M50 90h32"/><circle cx="111" cy="115" r="24"/><path d="M111 101v15l9 6"/>',
tradition:'<path d="M27 57h45v42c0 19-45 19-45 0zM72 65h8c20 0 20 26 0 26h-8M94 57h38v42c0 19-38 19-38 0zM132 65h5c17 0 17 26 0 26h-5M43 27c-10 13 11 15 0 24M60 22c-10 13 11 15 0 24M111 25c-10 13 11 15 0 24M20 126h130"/>'
};return '<svg class="'+cls+'" viewBox="0 0 165 150" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">'+shapes[type]+'</svg>';
};
const btn=(label,action,secondary=false,extra='')=>'<button class="btn'+(secondary?' secondary':'')+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
const go=(label,to)=>'<button class="link" data-go="'+to+'">'+label+' →</button>';
const panel=(body)=>'<section class="panel">'+body+'</section>';
const side=(type,title,body)=>'<aside class="aside">'+art(type)+'<div><h3>'+title+'</h3><p>'+body+'</p></div><div class="aside-section"><h3>В своём темпе</h3><p>Можно отложить или пропустить. Новое занятие не становится обязательством.</p></div></aside>';
const headings={guess:['Игра для двоих','Угадай меня','Выберите ответ про себя. Затем предположите, что выберет партнёр.'],date:['Свидание из конверта','Немного неожиданного','Выберите комфортные условия. Сам сценарий раскроется по шагам.'],surprise:['Маленький сюрприз','Порадовать своего человека','Небольшая идея заботы, которую вы можете воплотить сами.'],wishes:['Нам обоим хочется','Найти общее желание','Выбирайте занятия для себя. Разрешайте открывать только взаимные совпадения.'],letter:['Открыть позже','Слова для следующей главы','Напишите партнёру письмо и выберите день, когда оно откроется.'],tradition:['Наши маленькие традиции','Пусть это будет нашим','Выберите простой ритуал, который хочется повторять вместе.']};
const questions=[
{q:'Какой вечер мне сейчас понравился бы больше?',opts:['Прогуляться и поговорить','Еда и любимый фильм','Попробовать что-то новое','Побыть дома без планов']},
{q:'Что сейчас скорее порадует меня?',opts:['Тёплые слова','Помощь с небольшим делом','Время вдвоём без отвлечений','Маленький сюрприз']},
{q:'Как мне хотелось бы провести свободное утро?',opts:['Подольше поспать','Спокойно позавтракать вместе','Отправиться на прогулку','Выбраться в новое место']}
];
const game={step:0,answers:{anna:[],alexey:[]},submitted:{anna:false,alexey:false}};
const demoGame={anna:[{own:3,guess:0},{own:2,guess:1},{own:1,guess:0}],alexey:[{own:3,guess:3},{own:0,guess:2},{own:1,guess:1}]};
let date={phase:'conditions',step:0,place:'Дома',approvals:{anna:false,alexey:false}};
let surprise={phase:'settings',budget:'0',category:'Слова',chosen:false};
const wishTitles=['Необычный завтрак','Прогулка с фотографиями','Новое блюдо вместе','Вечер без телефонов','Письмо друг другу','Поездка на выходные'];
const wishes={anna:{selected:[true,false,true,false,false,false],share:[false,false,false,false,false,false]},alexey:{selected:[true,true,false,false,false,false],share:[false,false,false,false,false,false]}};
let wishView='list',plan={proposed:false,id:0,approvals:{anna:false,alexey:false}};
let letter={phase:'draft',text:'Мне особенно дорог наш вечер у реки. Спасибо, что умеешь превращать обычную прогулку в маленькое приключение.\n\nХочу, чтобы в следующей главе у нас было больше таких вечеров.',date:'2026-11-03',time:'19:00',version:1};
let ritual={phase:'proposal',name:'Наш медленный завтрак',text:'В выбранный выходной — 15 минут без обсуждения дел. Каждый может назвать один приятный момент недели.',rhythm:'Раз в неделю',approvals:{anna:false,alexey:false},note:''};
const paused={anna:false,alexey:false};
const notifications={channel:'Не подключён',ready:true,reminders:false,time:'19:00'};
const preset=params.get('state');
if(screen==='guess'&&['waiting','revealed'].includes(preset)){game.answers.anna=demoGame.anna;game.submitted.anna=true;if(preset==='revealed'){game.answers.alexey=demoGame.alexey;game.submitted.alexey=true;}}
if(screen==='date'&&['confirm','open','complete'].includes(preset)){date.phase=preset;date.approvals.anna=true;if(preset!=='confirm')date.approvals.alexey=true;}
if(screen==='surprise'&&preset==='chosen'){surprise.phase='chosen';surprise.chosen=true;}
if(screen==='wishes'&&['matched','plan'].includes(preset)){wishes.anna.share[0]=true;wishes.alexey.share[0]=true;wishView='matches';if(preset==='plan'){plan.proposed=true;plan.approvals.anna=true;}}
if(screen==='letter'&&['scheduled','opened','cancelled'].includes(preset)){letter.phase=preset;if(preset==='opened')actor='alexey';}
if(screen==='tradition'&&['waiting','active','paused'].includes(preset)){ritual.approvals.anna=true;if(preset==='waiting')ritual.phase='waiting';else{ritual.approvals.alexey=true;ritual.phase='active';if(preset==='paused')paused[actor]=true;}}
function intro(){
if(screen==='home')return '<div class="intro"><div><div class="eyebrow">Грани · Вдвоём</div><h1>Время для нас</h1><p>Разговоры, маленькие открытия и занятия, которые становятся вашей историей.</p></div><span class="pill">Анна и Алексей · вымышленный пример</span></div>';
const [k,h,p]=headings[screen];return '<a class="crumb" href="?screen=home" data-go="home">← Для нас</a><div class="intro"><div><div class="eyebrow">'+k+'</div><h1>'+h+'</h1><p>'+p+'</p></div></div>';
}
function home(){
const tiles=[
['guess','Угадай меня','Три вопроса. Ваш выбор и догадка о партнёре.','Сыграть','3–5 минут'],
['date','Свидание из конверта','Комфортные условия известны заранее. Сценарий — маленький сюрприз.','Выбрать свидание','20–30 минут'],
['surprise','Маленький сюрприз','Выберите, чем порадовать партнёра в обычном дне.','Найти идею','Без покупок'],
['wishes','Нам обоим хочется','Откройте общие желания и превратите одно в план.','Выбрать желания','Когда захочется'],
['letter','Открыть позже','Письмо к важной дате или просто следующему месяцу.','Написать письмо','Личное послание'],
['tradition','Наши маленькие традиции','Создайте ритуал, который будет только вашим.','Выбрать традицию','В вашем ритме']
];
return '<section class="home-hero"><div><div class="eyebrow">Попробуйте сегодня · Игра для двоих</div><h2>А что бы выбрал ты?</h2><p>Кажется, вы хорошо знаете друг друга. Всё равно может найтись приятная неожиданность.</p>'+btn('Сыграть в «Угадай меня» →','open-guess')+'<p class="small space">Каждый отвечает в удобное время.</p></div><div class="hero-art">'+art('guess')+'<span class="caption">Два выбора. Одно открытие.</span></div></section><div class="section-heading"><h2>Выберите своё настроение</h2><p>Можно открыть любой формат. Здесь нет ежедневных обязательств.</p></div><section class="catalog">'+tiles.map(([id,title,copy,action,time])=>'<article class="tile"><div class="tile-visual"><span class="badge">'+time+'</span>'+art(id)+'</div><h3>'+title+'</h3><p>'+copy+'</p>'+go(action,id)+'</article>').join('')+'</section><section class="history"><div><div class="eyebrow">Наша история</div><h3>То, что хочется сохранить</h3><p>Выбранные слова и воспоминания постепенно станут вашей электронной книгой.</p></div><a class="btn secondary" href="./index.html?screen=book">Посмотреть книгу →</a></section>';
}
const options=(items,name,checked)=>'<div class="options">'+items.map((t,i)=>'<label class="option"><input type="radio" name="'+name+'" value="'+i+'" '+(String(checked)===String(i)?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div>';
function guess(){
let content;
if(game.submitted.anna&&game.submitted.alexey){
content='<div class="eyebrow">Вы оба закончили</div><h2>Ваши ответы открыты</h2><p class="muted">Совпадения и различия — повод узнать друг друга. Здесь нет оценки отношений.</p>'+questions.map((q,i)=>'<div class="line"><h3>'+q.q+'</h3><div class="answer-pair">'+['anna','alexey'].map(a=>{const b=a==='anna'?'alexey':'anna';return '<div class="paper"><div class="eyebrow">'+names[a]+' · Свой выбор</div><h3>'+esc(q.opts[game.answers[a][i]?.own]??'Пропущено')+'</h3><p class="small">'+names[b]+' предположил'+(b==='anna'?'а':'')+': '+esc(q.opts[game.answers[b][i]?.guess]??'Не знаю')+'</p></div>';}).join('')+'</div></div>').join('')+'<div class="line"><h3>Что хочется попробовать?</h3><p class="space">'+(game.answers.anna[0]?.own===3&&game.answers.alexey[0]?.own===3?'У вас обоих совпал спокойный вечер дома. Можно выбрать подходящее свидание.':'Расскажите, что вам понравилось в выборе другого. Затем выберите подходящее обоим занятие.')+'</p>'+go('Открыть идею вечера','date')+'</div>';
}else if(game.submitted[actor]){
content='<div class="waiting">'+art('guess')+'<div class="eyebrow space">Ответы сохранены</div><h2>Продолжите, когда оба готовы</h2><p>Сейчас ответы партнёра скрыты. Можно закрыть страницу и вернуться позже.</p>'+btn('Выбрать уведомления','settings',true)+'<p class="small space">В этом макете уведомления не отправляются.</p></div>';
}else{
const i=game.step,q=questions[i],a=game.answers[actor][i]??{};
content='<div class="eyebrow">'+names[actor]+' · Ваши ответы</div><div class="game-dots">'+questions.map((_,j)=>'<span class="dot '+(j===i?'current':'')+'">'+(j+1)+'</span>').join('')+'</div><h2>'+q.q+'</h2><form id="gameForm"><div class="game-cols"><div><h3>Я выбираю для себя</h3>'+options(q.opts.concat(['Пропустить']),'own',a.own)+'</div><div><h3>Мне кажется, '+names[other()]+' выберет</h3>'+options(q.opts.concat(['Не знаю — хочу узнать']),'guess',a.guess)+'</div></div><p id="gameError" class="small space" role="status"></p><div class="row space"><button class="btn" type="submit">'+(i<2?'Следующий вопрос →':'Сохранить мои ответы →')+'</button>'+btn('Отложить','home',true)+'</div></form>';
}
return '<div class="layout">'+panel(content)+side('guess','Любопытство вместо баллов','Каждый выбирает за себя и предполагает ответ другого. Оба вида ответов откроются, когда вы закончите.')+'</div>';
}
function datePage(){
let c;
if(date.phase==='conditions'){
c='<div class="eyebrow">Сначала — комфортные условия</div><h2>Каким будет ваше свидание?</h2><form id="dateForm" class="form"><div class="two"><label><span class="label">Где</span><select id="datePlace"><option>Дома</option><option>На расстоянии</option></select></label><label><span class="label">Сколько времени</span><select><option>20–30 минут</option></select></label></div><label><span class="label">Бюджет</span><select><option>Без обязательных покупок</option></select></label><div class="paper"><div class="eyebrow">Что приготовить</div><p class="space">Возможность послушать музыку привычным способом. Можно заменить песни воспоминаниями.</p></div><button class="btn" type="submit">Предложить эти условия →</button><p class="small">Партнёр подтвердит условия перед открытием конверта.</p></form>';
}else if(date.phase==='confirm'){
c='<div class="eyebrow">Условия свидания</div><h2>'+ (date.place==='На расстоянии'?'Вечер на расстоянии':'Небольшой вечер дома')+'</h2><div class="stage-bar"><span>20–30 минут</span><span>Без покупок</span></div><p>Подготовьте возможность послушать музыку. Сценарий можно открыть целиком или по шагам.</p>'+confirmations(date.approvals)+'<div class="row space">'+btn(date.approvals[actor]?'Ожидаем подтверждения партнёра':'Мне подходят эти условия →','confirm-date',false,date.approvals[actor]?'disabled':'')+btn('Выбрать другие условия','date-reset',true)+'</div>';
}else if(date.phase==='complete'){
c='<div class="waiting">'+art('date')+'<h2>Останется вашей историей</h2><p>Можно сохранить личное воспоминание о вечере. Партнёр решает за свои материалы отдельно.</p><label class="label" for="dateNote">Моя заметка</label><textarea id="dateNote" placeholder="Вымышленное воспоминание для примера"></textarea>'+btn('Сохранить личный черновик','save-date-note',false,'style="margin-top:20px"')+'</div>';
}else{
const steps=['Каждый выбирает песню, которая напоминает о начале отношений. Можно выбрать воспоминание без музыки.','По очереди послушайте песни и расскажите, какой момент вспомнили.','Предложите песню или название для следующей главы вашей истории.'];
c='<div class="eyebrow">Конверт открыт</div><h2>Вечер двух песен</h2><div class="stage-bar">'+steps.map((_,i)=>'<span class="'+(i===date.step?'active':'')+'">Шаг '+(i+1)+'</span>').join('')+'</div>'+art('date','envelope')+'<p class="date-step">'+steps[date.step]+'</p><div class="row">'+btn(date.step<2?'Следующий шаг →':'Завершить свидание →','next-date')+btn('Посмотреть весь сценарий','all-date',true)+'</div><p class="small space">Шаги можно открывать самим. Ждать подтверждения каждого шага не нужно.</p>';
}
return '<div class="layout">'+panel(c)+side('date','Сюрприз без неудобств','Условия известны заранее. Занятие можно отложить или заменить. На расстоянии — созвониться в привычном сервисе.')+'</div>';
}
function surprisePage(){
let c;
if(surprise.phase==='settings'){
c='<div class="eyebrow">Идея от вас — для партнёра</div><h2>Начнём с небольшой заботы</h2><form id="surpriseForm" class="form"><label><span class="label">Что приятно Алексею · вымышленный выбор</span><select id="surpriseCategory"><option>Слова</option></select></label><label><span class="label">Ваш бюджет</span><select id="surpriseBudget"><option value="0">Без покупок</option></select></label><p class="small">В рабочем продукте категории выбирает сам получатель. Его личные записи остаются личными.</p><button class="btn" type="submit">Показать подходящие идеи →</button></form>';
}else if(surprise.phase==='ideas'){
c='<div class="eyebrow">Без покупок · До 5 минут</div><h2>Что хочется сделать?</h2><div class="choice-grid"><div class="idea"><h3>Две тёплые фразы</h3><p class="small">Заметить приятное действие и сказать, почему оно важно.</p>'+btn('Выбрать эту идею','choose-surprise',false,'style="margin-top:20px"')+'</div><div class="idea"><h3>Сказать лично</h3><p class="small">Выбрать спокойный момент и поблагодарить за что-то конкретное.</p>'+btn('Выбрать разговор','choose-surprise-talk',true,'style="margin-top:20px"')+'</div></div>'+btn('Другие условия','surprise-reset',true,'style="margin-top:24px"');
}else{
c='<div class="eyebrow">Ваш выбор · Не отправлен партнёру</div><h2>'+ (surprise.talk?'Сказать лично':'Две тёплые фразы')+'</h2><p>Вспомните небольшое действие партнёра, которое вас порадовало. Расскажите, почему оно важно.</p><div class="letter-paper"><p class="quote">Мне было приятно, когда ты ____. Для меня это ____.</p></div><p class="small">Можно написать записку, сказать лично или отправить сообщение самим. Отчёт о выполнении не нужен.</p><div class="row space">'+btn('Выбрать другую идею','surprise-ideas',true)+btn('Сохранить мою заметку','surprise-note',true)+'</div>';
}
return '<div class="layout">'+panel(c)+side('surprise','Забота происходит в жизни','Мы предлагаем идею. Вы сами решаете, хочется ли воплотить её и как. Сервис не сообщает партнёру о вашем выборе.')+'</div>';
}
function confirmations(values){
return ['anna','alexey'].map(a=>'<div class="confirm-row"><span class="person '+(a==='alexey'?'alt':'')+'">'+names[a][0]+'</span><span>'+names[a]+'</span><span>'+ (values[a]?'Подтверждено':'Пока не подтверждено')+'</span></div>').join('');
}
function wishesPage(){
let c;
if(wishView==='list'){
c='<div class="eyebrow">'+names[actor]+' · Личный список</div><h2>Что вам хочется попробовать?</h2><p class="small">Партнёр увидит только разрешённые общие совпадения. Чужой личный список здесь не показывается.</p><div class="wish-grid space">'+wishTitles.map((t,i)=>'<div class="wish"><h3>'+t+'</h3><label class="checkbox"><input type="checkbox" data-wish="'+i+'" '+(wishes[actor].selected[i]?'checked':'')+'>Мне хочется</label>'+(wishes[actor].selected[i]?'<label class="checkbox"><input type="checkbox" data-share="'+i+'" '+(wishes[actor].share[i]?'checked':'')+'>Показать, если выберем оба</label>':'')+'</div>').join('')+'</div><div class="row space">'+btn('Посмотреть общие совпадения →','wish-matches')+'</div>';
}else{
const matches=wishTitles.map((t,i)=>({t,i})).filter(({i})=>wishes.anna.selected[i]&&wishes.alexey.selected[i]&&wishes.anna.share[i]&&wishes.alexey.share[i]);
c='<div class="eyebrow">Разрешено вами обоими</div><h2>'+ (matches.length?'Вам обоим хочется':'Пока нет открытых совпадений')+'</h2>'+ (matches.length?matches.map(({t,i})=>'<div class="match"><div class="eyebrow">Общее желание</div><h3>'+t+'</h3><p class="small">Выбор не означает обязательство. Можно обсудить, хочется ли сделать это сейчас.</p>'+btn('Предложить план →','wish-plan',false,'data-id="'+i+'" style="margin-top:20px"')+'</div>').join(''):'<p>Можно выбрать другие идеи или придумать занятие вместе. Это не оценка ваших отношений.</p>')+
(plan.proposed?'<div class="paper space"><h3>'+esc(wishTitles[plan.id])+'</h3><p class="small space">Вымышленный план · Суббота, 10 октября, 10:00 · Дома, без покупок</p>'+confirmations(plan.approvals)+'<div class="row space">'+btn(plan.approvals[actor]?'Ваше подтверждение сохранено':'Мне подходит этот план →','confirm-plan',false,plan.approvals[actor]?'disabled':'')+'</div><p class="small space">'+(plan.approvals.anna&&plan.approvals.alexey?'Вы оба подтвердили план.':'Пока это предложение, а не общая договорённость.')+'</p></div>':'')+btn('Вернуться к моему списку','wish-list',true,'style="margin-top:24px"');
}
return '<div class="layout">'+panel(c)+side('wishes','Открываются только совпадения','Каждый разрешает раскрытие отдельно. Невыбранные желания и отказы остаются личными. Разрешение можно убрать.')+'</div>';
}
function letterPage(){
let c;
if(actor==='alexey'&&['draft','cancelled'].includes(letter.phase)){
c='<div class="waiting">'+art('letter')+'<h2>Ваши письма появятся здесь</h2><p>Личные черновики партнёра вам недоступны. В этом примере открытых писем пока нет.</p></div>';
}else if(letter.phase==='draft'){
c='<div class="eyebrow">От Анны · Для Алексея</div><h2>Что хочется сказать?</h2><form id="letterForm" class="form"><label><span class="label">Ваше письмо</span><textarea id="letterText" maxlength="3000">'+esc(letter.text)+'</textarea></label><div class="two"><label><span class="label">Дата открытия</span><input id="letterDate" type="date" value="'+letter.date+'" required></label><label><span class="label">Время</span><input id="letterTime" type="time" value="'+letter.time+'" required></label></div><p class="small">Часовой пояс: Екатеринбург · UTC+5. В рабочем продукте будет ваш часовой пояс.</p><div class="row"><button class="btn" type="submit">Запланировать открытие →</button>'+btn('Оставить черновиком','letter-draft',true)+'</div><p class="small">До открытия письмо видите только вы. Его можно изменить или удалить.</p></form>';
}else if(letter.phase==='opened'){
c='<div class="eyebrow">Письмо открылось · Вымышленный пример</div><h2>Алексей, это для тебя</h2><div class="letter-paper"><div class="eyebrow">От Анны</div><p class="quote space">'+esc(letter.text)+'</p><p class="small space">3 ноября · 19:00</p></div><p class="small">Ответить можно лично или в привычном чате. Письмо не добавляется в книгу автоматически.</p>';
}else if(letter.phase==='cancelled'){
c='<div class="waiting">'+art('letter')+'<h2>Открытие отменено</h2><p>В макете письмо остаётся вашим черновиком. Партнёр его не получил.</p>'+btn('Вернуться к черновику','letter-edit',true)+'</div>';
}else if(actor==='alexey'){
c='<div class="waiting">'+art('letter')+'<h2>Письмо пока закрыто</h2><p>Демонстрационный вид адресата. Текст станет доступен в выбранный автором день.</p><p class="small">3 ноября · 19:00 · Екатеринбург</p></div>';
}else{
c='<div class="waiting">'+art('letter')+'<div class="eyebrow space">Открытие запланировано</div><h2>Слова ждут своего дня</h2><p>'+esc(letter.date)+' · '+esc(letter.time)+' · Екатеринбург</p></div><div class="letter-paper"><div class="eyebrow">Только для автора</div><p class="quote space">'+esc(letter.text)+'</p></div><div class="row">'+btn('Изменить письмо','letter-edit',true)+btn('Отменить открытие','letter-cancel',true)+'</div><p class="small space">Уже запланированное письмо не требует продления подписки для открытия, пока вы оба остаётесь участниками и отправка не отозвана.</p>';
}
return '<div class="layout">'+panel(c)+side('letter','Личное послание','До выбранной даты текст доступен только автору. В уведомлении будет сообщение об открытии и ссылка, без текста письма.')+'</div>';
}
function traditionPage(){
let c;
if(ritual.phase==='proposal'){
c='<div class="eyebrow">Предложите свою традицию</div><h2>Что хочется повторять?</h2><form id="ritualForm" class="form"><label><span class="label">Название</span><input id="ritualName" type="text" maxlength="100" value="'+esc(ritual.name)+'" required></label><label><span class="label">Как это будет</span><textarea id="ritualText" maxlength="1000">'+esc(ritual.text)+'</textarea></label><label><span class="label">Ритм</span><select id="ritualRhythm"><option>Раз в неделю</option><option>Раз в месяц</option><option>Когда захочется</option></select></label><button class="btn" type="submit">Предложить партнёру →</button><p class="small">Общая традиция появится после подтверждения обоих.</p></form>';
}else{
c='<div class="eyebrow">'+(paused[actor]?'Моё участие на паузе':ritual.phase==='active'?'Ваша традиция':'Предложение традиции')+'</div><h2>'+esc(ritual.name)+'</h2><p class="quote-summary">'+esc(ritual.text)+'</p><div class="stage-bar"><span>'+esc(ritual.rhythm)+'</span><span>Без покупок</span></div>'+confirmations(ritual.approvals);
if(ritual.phase==='waiting')c+='<div class="row space">'+btn(ritual.approvals[actor]?'Ожидаем подтверждения партнёра':'Мне нравится эта традиция →','confirm-ritual',false,ritual.approvals[actor]?'disabled':'')+btn('Предложить изменение','ritual-edit',true)+'</div>';
else if(paused[actor])c+='<p class="space">Ваше участие и напоминания на паузе. История сохранена. Оплаченный срок продолжается.</p>'+btn('Возобновить моё участие','ritual-resume',true,'style="margin-top:20px"');
else c+='<div class="paper space"><h3>Момент, который хочется сохранить</h3><label class="label space" for="ritualNote">Моя личная заметка</label><textarea id="ritualNote" placeholder="Вымышленный пример">'+esc(ritual.note)+'</textarea>'+btn('Сохранить мой черновик','ritual-note',true,'style="margin-top:20px"')+'</div><div class="row space">'+btn('Настроить мои напоминания','settings',true)+btn('Поставить моё участие на паузу','ritual-pause',true)+'</div><p class="small space">Никаких обязательных серий. Любимый ритуал можно повторять без отчётов.</p>';
}
return '<div class="layout">'+panel(c)+side('tradition','То, что становится вашим','Ритм подтверждают оба. Каждый может остановить своё участие и напоминания самостоятельно. Личные заметки сохраняются отдельно.')+'</div>';
}
function render(focus=false){
const views={home,guess,date:datePage,surprise:surprisePage,wishes:wishesPage,letter:letterPage,tradition:traditionPage};
document.querySelector('#app').innerHTML='<header class="wrap head"><a class="brand" href="?screen=home" data-go="home"><svg viewBox="0 0 28 32" aria-hidden="true" fill="none" stroke="currentColor"><path d="m14 1 12 8v14l-12 8-12-8V9zM14 1v30M2 9l24 14M26 9 2 23"/></svg>Грани <small>Вдвоём</small></a><nav class="nav" aria-label="Разделы"><a href="?screen=home" data-go="home" aria-current="page">Для нас</a><a class="desktop" href="./index.html?screen=book">Наша история</a><button class="link desktop" data-action="settings">Уведомления</button><div class="people"><span class="person">А</span><span>и</span><span class="person alt">А</span></div></nav></header><main class="wrap" tabindex="-1">'+intro()+views[screen]()+'</main><footer class="wrap footer">Грани. Вдвоём · Личное пространство пары · Все сюжеты и имена в этом макете вымышленные</footer>';
document.querySelector('#tools').innerHTML='<div><div class="small">Только для просмотра макета · Участник</div><div class="row">'+['anna','alexey'].map(a=>'<button data-actor="'+a+'" aria-pressed="'+(a===actor)+'">'+names[a]+'</button>').join('')+'</div></div><div><div class="small">Демонстрационные состояния</div><div class="row">'+(screen==='letter'?'<button data-action="demo-open-letter">Показать день открытия</button>':'')+'<button data-action="reset">Начать этот макет заново</button><button data-go="home">Все форматы</button></div></div>';
if(focus){document.querySelector('main').focus({preventScroll:true});scrollTo(0,0);}
}
function navigate(to){screen=valid.includes(to)?to:'home';game.step=0;history.replaceState({},'', '?screen='+screen);render(true);}
function say(text){document.querySelector('#notice').textContent=text;}
function settings(){
const d=document.querySelector('#settings');d.innerHTML='<button class="close" data-action="close-settings" aria-label="Закрыть">×</button><div class="eyebrow">Личные настройки · Демонстрация</div><h2 id="settingsTitle">Как вам удобно?</h2><form id="settingsForm" class="form"><label><span class="label">Канал</span><select id="channel"><option>Не подключён</option><option>ВКонтакте · пример подключения</option><option>Telegram · пример подключения</option></select></label><label class="checkbox"><input id="notifyReady" type="checkbox" '+(notifications.ready?'checked':'')+'>Когда оба ответили</label><label class="checkbox"><input id="notifyReminders" type="checkbox" '+(notifications.reminders?'checked':'')+'>Напоминать о выбранных занятиях</label><label><span class="label">Удобное время</span><input id="notifyTime" type="time" value="'+notifications.time+'"></label><p class="small">Тихие часы: 22:00–09:00 · Екатеринбург. В макете нет реального подключения и доставки.</p><button class="btn" type="submit">Сохранить настройки макета</button></form>';d.querySelector('#channel').value=notifications.channel;d.showModal();
}
document.addEventListener('click',e=>{
const nav=e.target.closest('[data-go]');if(nav){e.preventDefault();navigate(nav.dataset.go);return;}
const changeActor=e.target.closest('[data-actor]');if(changeActor){actor=changeActor.dataset.actor;game.step=0;render();return;}
const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
switch(b.dataset.action){
case 'open-guess':navigate('guess');break;case 'home':navigate('home');break;
case 'settings':settings();break;case 'close-settings':document.querySelector('#settings').close();break;
case 'reset':location.href='?screen='+screen;break;
case 'confirm-date':date.approvals[actor]=true;if(date.approvals.anna&&date.approvals.alexey)date.phase='open';render();break;
case 'date-reset':date={phase:'conditions',step:0,place:'Дома',approvals:{anna:false,alexey:false}};render();break;
case 'next-date':if(date.step<2)date.step++;else date.phase='complete';render();break;
case 'all-date':{const d=document.querySelector('#settings');d.innerHTML='<button class="close" data-action="close-settings" aria-label="Закрыть">×</button><h2 id="settingsTitle">Вечер двух песен</h2><p>1. Выберите песни или воспоминания о начале отношений.</p><p class="space">2. По очереди послушайте и расскажите о своих моментах.</p><p class="space">3. Выберите песню или название следующей главы.</p><p class="small space">20–30 минут · Без обязательных покупок</p>';d.showModal();break;}
case 'save-date-note':say('Личный черновик сохранён только в памяти макета.');b.textContent='Черновик сохранён';break;
case 'choose-surprise':case 'choose-surprise-talk':surprise.phase='chosen';surprise.talk=b.dataset.action.endsWith('talk');surprise.chosen=true;render();break;
case 'surprise-reset':surprise.phase='settings';render();break;case 'surprise-ideas':surprise.phase='ideas';render();break;
case 'surprise-note':b.textContent='Идея сохранена для вас';say('Вымышленная идея сохранена в памяти макета.');break;
case 'wish-matches':wishView='matches';render();break;case 'wish-list':wishView='list';render();break;
case 'wish-plan':plan.id=Number(b.dataset.id);plan.proposed=true;plan.approvals={anna:false,alexey:false};plan.approvals[actor]=true;render();break;
case 'confirm-plan':plan.approvals[actor]=true;render();break;
case 'letter-edit':letter.phase='draft';actor='anna';render();break;
case 'letter-cancel':letter.phase='cancelled';letter.version++;render();break;
case 'letter-draft':letter.text=document.querySelector('#letterText').value;b.textContent='Черновик сохранён';say('Черновик остаётся личным.');break;
case 'demo-open-letter':if(letter.phase==='scheduled'){letter.phase='opened';actor='alexey';render();}else say('Сначала запланируйте письмо.');break;
case 'confirm-ritual':ritual.approvals[actor]=true;if(ritual.approvals.anna&&ritual.approvals.alexey)ritual.phase='active';render();break;
case 'ritual-edit':ritual.phase='proposal';ritual.approvals={anna:false,alexey:false};render();break;
case 'ritual-pause':paused[actor]=true;render();break;case 'ritual-resume':paused[actor]=false;render();break;
case 'ritual-note':ritual.note=document.querySelector('#ritualNote').value;b.textContent='Личный черновик сохранён';say('Заметка не добавлена автоматически в книгу.');break;
}
});
document.addEventListener('change',e=>{
const t=e.target;if(t.dataset.wish!==undefined){const i=Number(t.dataset.wish);wishes[actor].selected[i]=t.checked;if(!t.checked)wishes[actor].share[i]=false;render();}
if(t.dataset.share!==undefined){wishes[actor].share[Number(t.dataset.share)]=t.checked;say('Разрешение обновлено.');}
});
document.addEventListener('submit',e=>{
e.preventDefault();
switch(e.target.id){
case 'gameForm':{
const data=new FormData(e.target);if(!data.has('own')||!data.has('guess')){document.querySelector('#gameError').textContent='Выберите свой ответ и предположение. Можно пропустить или выбрать «Не знаю».';return;}
game.answers[actor][game.step]={own:Number(data.get('own')),guess:Number(data.get('guess'))};if(game.step<2)game.step++;else game.submitted[actor]=true;render();break;}
case 'dateForm':date.place=document.querySelector('#datePlace').value;date.phase='confirm';date.approvals[actor]=true;render();break;
case 'surpriseForm':surprise.category=document.querySelector('#surpriseCategory').value;surprise.phase='ideas';render();break;
case 'letterForm':letter.text=document.querySelector('#letterText').value.trim();if(!letter.text){document.querySelector('#letterText').setCustomValidity('Напишите письмо или оставьте черновик.');document.querySelector('#letterText').reportValidity();return;}letter.date=document.querySelector('#letterDate').value;letter.time=document.querySelector('#letterTime').value;letter.phase='scheduled';letter.version++;render();break;
case 'ritualForm':ritual.name=document.querySelector('#ritualName').value.trim();ritual.text=document.querySelector('#ritualText').value.trim();ritual.rhythm=document.querySelector('#ritualRhythm').value;ritual.phase='waiting';ritual.approvals={anna:false,alexey:false};ritual.approvals[actor]=true;render();break;
case 'settingsForm':notifications.channel=document.querySelector('#channel').value;notifications.ready=document.querySelector('#notifyReady').checked;notifications.reminders=document.querySelector('#notifyReminders').checked;notifications.time=document.querySelector('#notifyTime').value;document.querySelector('#settings').close();say('Настройки демонстрации сохранены. Реальные уведомления не отправляются.');break;
}
});
document.addEventListener('input',e=>{if(e.target.id==='letterText')e.target.setCustomValidity('');});
render();
})();