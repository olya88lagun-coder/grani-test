(() => {
"use strict";
const VIEWS={start:"Первый вход",login:"Авторизация",create:"Создание пары",invite:"Готовая ссылка",lost:"Ссылка не сохранена",public:"По приглашению",invalid:"Недоступная ссылка",requested:"Запрос отправлен",confirm:"Подтверждение имени",ready:"Пара создана",checkout:"Оплата для двоих",gateway:"Перед оплатой",waiting:"Проверка платежа",success:"Доступ подтверждён",delayed:"Платёж без доступа",cancelled:"Оплата не завершена",paid:"Оплаченный доступ",limit:"Продление пока недоступно",unavailable:"Оплата отключена",error:"Ошибка соединения",loading:"Загрузка",left:"Выход из пары"};
const q=new URLSearchParams(location.search);
let view=Object.hasOwn(VIEWS,q.get("view"))?q.get("view"):"start";
let actor=q.get("actor")==="partner"?"partner":"initiator";
let agreed=false,authReady=false,logged=false,busy=false,hadLink=false;
let email="",provider="",pendingName="Алексей",error="";
let inviteRevision=1;
let inviteURL="https://grani.example/together/invite/demo-example-1";
const events=[];
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const names={initiator:"Анна",partner:"Алексей"};
const btn=(label,action,secondary=false,disabled=false)=>'<button type="button" class="btn'+(secondary?' secondary':'')+'" data-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
const link=(label,action)=>'<button type="button" class="text-link" data-action="'+action+'">'+label+'</button>';
const mark=()=>'<svg class="s1-art" viewBox="0 0 180 160" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><ellipse cx="71" cy="76" rx="44" ry="63" transform="rotate(-23 71 76)"/><ellipse cx="110" cy="77" rx="44" ry="63" transform="rotate(23 110 77)"/><path d="M26 143h128"/></svg>';
const person=(name,label)=>'<div class="s1-person"><span class="avatar">'+escape(name.trim().slice(0,1)||'?')+'</span><div><strong>'+escape(name)+'</strong><p class="s1-mini">'+label+'</p></div></div>';
const state=(title,description)=>'<div class="s1-status" role="status"><strong>'+title+'</strong><br>'+description+'</div>';
const legal=()=>'<div class="s1-links"><a href="/offer" data-legal>Оферта</a><a href="/privacy" data-legal>Политика обработки данных</a></div>';
const panel=body=>'<section class="s1-panel">'+body+'</section>';
function log(action,payload={}){events.push({action,...payload});window.stage1Events=events.slice();}
function announce(s){document.querySelector("#stage1Notice").textContent=s;}
function go(next){view=next;error="";busy=false;history.replaceState({},'','?view='+view);render(true);}
function copyIntro(kicker,title,body,actions=""){return '<section class="s1-copy"><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p class="lead muted">'+body+'</p>'+actions+'</section>';}
function layout(left,right){return '<div class="s1-layout">'+left+right+'</div>';}
function steps(){return '<div class="s1-facts"><div><span class="s1-number">1</span><p>Каждый входит в свой аккаунт.</p></div><div><span class="s1-number">2</span><p>Один приглашает, второй отправляет запрос. Инициатор подтверждает имя.</p></div><div><span class="s1-number">3</span><p>Знакомитесь с программой. Продолжение — одна оплата за двоих.</p></div></div>';}
function start(){return layout(copyIntro('Грани · Вдвоём','Начнём с вас двоих','Небольшие разговоры, игры и совместные занятия. Без обязательного личностного теста.','<div class="row">'+btn('Создать пространство для двоих','start')+'</div><p class="s1-info">Три вводных вопроса — без банковской карты. Продолжение — по желанию. Знакомство будет доступно после подключения каталога.</p>'),panel(mark()+'<h2>Два аккаунта.<br>Одна история.</h2>'+steps()+'<p class="s1-mini">В этом макете можно пройти весь путь на вымышленных данных.</p>'));}
function login(){
const next=q.get("target")==="public"?"public":provider||actor==="partner"?"public":"create";
let body='<h2>Ваш собственный аккаунт</h2><p>Для каждого участника — свой вход. Это нужно, чтобы личные ответы и материалы оставались под вашим контролем.</p>';
if(!authReady)body+='<label class="s1-check"><input id="consentInput" type="checkbox" '+(agreed?'checked':'')+'><span>Я соглашаюсь на <a href="/consent" data-legal>обработку персональных данных</a> в соответствии с <a href="/privacy" data-legal>политикой</a>.</span></label>'+btn(busy?'Сохраняем согласие…':'Продолжить','consent',false,!agreed||busy);
else body+='<div class="stack">'+btn('Войти через VK ID','login-vk')+'</div><p class="s1-mini">После входа вернём вас к '+(next==="public"?'приглашению.':'созданию пары.')+'</p>';
if(error)body+='<p class="s1-error" role="alert">'+escape(error)+'</p>';
return layout(copyIntro('Вход во Вдвоём','Один шаг до начала','Вход только через VK ID. Проходить тест «Грани» не нужно.'),panel(body));
}
function create(){return layout(copyIntro('Создание пространства','Анна, начнём с двоих','Вы создадите пространство, а затем отправите партнёру личную ссылку.','<div class="row">'+btn(busy?'Создаём пространство…':'Создать и получить приглашение','create',false,busy)+'</div><p class="s1-info">Сначала подтвердите участие обоих. До этого оплату не предлагаем.</p>'),panel(mark()+'<h2>Место для вашей истории</h2><ul class="s1-list"><li>У каждого свой аккаунт.</li><li>В общее пространство входят двое.</li><li>Оплата после знакомства — одна за пару.</li></ul>'));}
function invite(lost=false){return layout(copyIntro('Приглашение партнёра','Теперь пригласите своего человека','Отправьте ссылку лично. Когда партнёр войдёт и отправит запрос, вы подтвердите его имя.'),panel('<div class="s1-tag"><span class="s1-dot"></span>Ожидаем запрос партнёра</div>'+mark()+'<h2>'+(lost?'Получить новую ссылку':'Ваше приглашение готово')+'</h2>'+(lost?'<p>Мы не можем восстановить прежнюю ссылку. Можно выпустить новую — старая перестанет работать.</p>'+btn('Создать новую ссылку','reissue'):'<label><span class="s1-label">Личная ссылка · вымышленный пример</span><input id="inviteLink" class="s1-input" readonly value="'+inviteURL+'"></label><div class="row">'+btn('Скопировать ссылку','copy')+btn('Обновить статус','refresh-invite',true)+'</div><p id="copyStatus" class="s1-mini" role="status"></p><p class="s1-mini">Приглашение действует 7 суток. Сохраните ссылку сейчас: при следующем входе она не будет показана повторно.</p>'+link('Выпустить новую ссылку','reissue-warning'))));}
function publicInvite(){return layout(copyIntro('Приглашение во Вдвоём','Время для вас двоих','Вас пригласили создать общее пространство. Здесь будут короткие разговоры, игры и ваша история.'),panel(mark()+'<h2>Присоединиться в своём аккаунте</h2><p>После запроса инициатор проверит ваше имя и подтвердит участие.</p>'+btn(logged?'Отправить запрос на участие':'Войти и продолжить','join-start')+'<p class="s1-mini">До подтверждения вы не получаете доступа к общим материалам. Личные данные пары по ссылке не раскрываются.</p>'));}
function invalid(){return layout(copyIntro('Приглашение','Эта ссылка сейчас недоступна','Она могла истечь, быть заменена или уже использована. Попросите партнёра отправить новое приглашение.','<div class="row">'+btn('Вернуться во Вдвоём','home',true)+'</div>'),panel(mark()+'<h2>Ваше пространство — личное</h2><p>По недоступной ссылке мы не показываем имена или данные пары.</p>'));}
function requested(){return layout(copyIntro('Запрос на участие','Осталось подтверждение','Вы отправили запрос. Инициатор увидит ваше имя и подтвердит, что приглашение предназначено вам.'),panel(mark()+state('Запрос отправлен','Можно закрыть страницу. Позже вернитесь по приглашению или во Вдвоём.')+btn('Проверить подтверждение','check-request',true)+'<p class="s1-mini">Уведомления будут подключены отдельным этапом. Сейчас обещать сообщение не можем.</p>'));}
function confirm(){return layout(copyIntro('Подтверждение партнёра','Это ваш человек?','Проверьте имя аккаунта, который отправил запрос. Подтверждайте только того, кого пригласили.'),panel('<div class="eyebrow">Запрос на участие</div>'+person(pendingName,'Отображаемое имя аккаунта')+'<p>После подтверждения вы станете участниками одного пространства.</p><div class="row">'+btn('Да, подтвердить партнёра','accept')+btn('Отклонить запрос','decline',true)+'</div><p class="s1-mini">Отказ не закрывает пространство. Приглашение снова можно использовать.</p>'));}
function ready(){return layout(copyIntro('Пара создана','Вы теперь вдвоём','Анна и Алексей подтвердили участие. Можно знакомиться с программой в своём темпе.','<div class="row">'+btn('Посмотреть вводный вопрос','preview-intro')+'</div><p class="s1-info">Бесплатное знакомство не требует оплаты. Ниже показан следующий шаг после знакомства.</p>'),panel('<div class="eyebrow">Продолжение программы</div><h2>Один доступ на двоих</h2><div class="s1-price">599 <span class="s1-currency">₽</span> <small>/ 30 дней</small></div><ul class="s1-list"><li>Вопросы, игры и сценарии совместного времени.</li><li>Личные и общие материалы вашей истории.</li><li>Повторная оплата — только по вашему выбору.</li></ul>'+btn('Посмотреть условия продолжения','checkout',true)+'<p class="s1-mini">Цена — рабочая гипотеза. Живая оплата включается после готовности программы.</p>'));}
function checkout(){
return layout(copyIntro('Продолжение для двоих','Больше хорошего между вами','Одна оплата открывает программу обоим участникам на 30 дней.'),panel('<div class="eyebrow">Грани · Вдвоём</div><h2>30 дней для вашей пары</h2><div class="s1-price">599 <span class="s1-currency">₽</span> <small>за двоих</small></div>'+person('Анна и Алексей','Участие обоих подтверждено')+'<form id="paymentForm" class="s1-form"><label><span class="s1-label">Электронная почта для чека</span><input id="receiptEmail" class="s1-input" type="email" autocomplete="email" maxlength="254" required value="'+escape(email)+'" placeholder="anna@example.com"></label><p class="s1-mini">Данные оплаты относятся к плательщику. Программа доступна вам обоим.</p><p class="s1-mini">Нажимая «Перейти к оплате», вы принимаете <a href="/offer" data-legal>оферту</a>. Автоматических списаний нет.</p><button type="submit" class="btn" '+(busy?'disabled':'')+'>'+(busy?'Готовим оплату…':'Перейти к оплате 599 ₽')+'</button><p id="paymentError" class="s1-error" role="alert">'+escape(error)+'</p></form><p class="s1-mini">В макете деньги не списываются. Настоящая оплата откроется на странице платёжного сервиса.</p>'));
}
function gateway(){return layout(copyIntro('Демонстрация перехода','Следующий шаг — защищённая оплата','В рабочем сервисе откроется страница платёжного провайдера. Здесь мы показываем только возвращение на сайт.'),panel('<h2>Макет без списания денег</h2><p>Выберите результат для просмотра. Эти кнопки не попадут в рабочий интерфейс.</p><div class="stack">'+btn('Показать возвращение после оплаты','return-payment')+btn('Показать отменённую оплату','cancel-payment',true)+'</div>'));}
function payment(viewName){
const data={
waiting:['Проверяем оплату','Возвращение на сайт ещё не подтверждает платёж. Проверяем статус и выдачу доступа.','Проверить статус','poll'],
success:['Доступ открыт для двоих','Платёж подтверждён и доступ выдан. Анна и Алексей могут продолжить программу.','Открыть пространство','paid'],
delayed:['Платёж подтверждён. Доступ проверяем.','Не оплачивайте повторно. Если пространство закрыто или доступ не выдан, потребуется проверка.','Проверить ещё раз','poll-delayed'],
cancelled:['Оплата не завершена','Можно вернуться к условиям и продолжить позже. Не оформляйте новую оплату, пока предыдущий статус не проверен.','Вернуться к условиям','checkout']
}[viewName];
return layout(copyIntro('Возвращение с оплаты',data[0],data[1]),panel(mark()+state(viewName==='success'?'Доступ действует до 5 ноября, 18:30':'Статус оплаты',viewName==='waiting'?'Ожидаем ответ платёжного сервиса.':viewName==='delayed'?'Уточняем выдачу доступа.':viewName==='cancelled'?'Платёж не завершён.':'Для обоих участников · ручное продление.')+btn(data[2],data[3],viewName!=='success')+(viewName==='delayed'?'<p class="s1-mini">В рабочем сервисе такой случай доступен владельцу для проверки. Автоматический возврат пока не подключён.</p>':'')));
}
function paid(limit=false){return layout(copyIntro('Ваше пространство','Анна и Алексей','Программа доступна вам обоим. У каждого свой вход, общая история и один срок доступа.','<div class="row">'+btn('Посмотреть макет первого вопроса','preview-intro')+'</div><p class="s1-info">Показана передача в следующий этап: подключение каталога и ответов.</p>'),panel('<div class="s1-tag"><span class="s1-dot"></span>Доступ активен</div><h2>Ваши 30 дней вдвоём</h2>'+state('До '+(limit?'5 декабря':'5 ноября')+', 18:30','Повторная оплата не происходит автоматически.')+(limit?'<p>Уже оплачен следующий период. Новую оплату предложим, когда останется не больше 30 суток доступа.</p>':btn('Добавить ещё 30 дней','checkout',true))+'<p class="s1-mini">Продление добавляет период после текущего. История и пройденные карточки сохраняются.</p>'+link('Выйти из пространства','leave-warning')));}
function unavailable(){return layout(copyIntro('Продолжение программы','Оплата пока недоступна','Возвращаться к программе можно после включения оплаты. В этом макете ничего не списывается.'),panel(mark()+state('Сейчас оплату не принимаем','Кнопка покупки появляется только после готовности платёжного сервиса и программы.')+btn('Вернуться в пространство','ready',true)));}
function failure(){return layout(copyIntro('Проверка состояния','Не получилось обновить данные','Проверьте соединение и попробуйте снова. Мы не считаем действие выполненным без подтверждения.'),panel(mark()+btn('Повторить проверку','retry')+'<p class="s1-mini">При повторе не создаётся новая покупка. Статус уточняем по уже созданной.</p>'));}
function loading(){return layout(copyIntro('Ваше пространство','Загружаем состояние','Проверяем участие и доступ, прежде чем показывать следующие действия.'),panel('<div class="s1-busy" aria-busy="true" aria-label="Загрузка пространства"><div class="s1-paper"><p>Подготавливаем информацию о паре…</p></div></div>'));}
function left(){return layout(copyIntro('Пространство закрыто','Участие завершено','Совместная программа и оплаченный доступ к этому пространству прекратились. Новые списания не выполняются.'),panel(mark()+'<h2>Остаток срока</h2><p>Не возвращается и не переносится автоматически. Вопрос об остатке требует отдельного решения владельца.</p>'+btn('Вернуться во Вдвоём','home',true)));}
const views={start,login,create,invite:()=>invite(false),lost:()=>invite(true),public:publicInvite,invalid,requested,confirm,ready,checkout,gateway,waiting:()=>payment('waiting'),success:()=>payment('success'),delayed:()=>payment('delayed'),cancelled:()=>payment('cancelled'),paid:()=>paid(false),limit:()=>paid(true),unavailable,error:failure,loading,left};
function render(focus=false){
document.querySelector('#stage1').innerHTML='<header class="wrap site-head"><a class="brand" href="?view=start" data-action="home"><svg class="logo" viewBox="0 0 28 32" aria-hidden="true" fill="none" stroke="currentColor"><path d="m14 1 12 8v14l-12 8-12-8V9zM14 1v30M2 9l24 14M26 9 2 23"/></svg>Грани <span class="brand-divider"></span><span class="brand-sub">Вдвоём</span></a><nav class="site-nav" aria-label="Навигация"><button class="text-link" data-action="home">Во Вдвоём</button></nav></header><main class="wrap s1-main" tabindex="-1">'+views[view]()+legal()+'</main><footer class="wrap s1-footer">Личное пространство пары · Одна оплата за двоих · Все данные этого макета вымышленные</footer>';
document.querySelector('#reviewTools').innerHTML='<label>Состояние макета<select id="viewSelect">'+Object.entries(VIEWS).map(([k,v])=>'<option value="'+k+'" '+(k===view?'selected':'')+'>'+v+'</option>').join('')+'</select></label><div><div class="tools-label">Роль только для демонстрации</div><div class="row"><button data-role="initiator" aria-pressed="'+(actor==='initiator')+'">Инициатор</button><button data-role="partner" aria-pressed="'+(actor==='partner')+'">Партнёр</button></div></div><button data-action="reset">Начать заново</button><a href="./index.html?screen=dashboard">Прежние макеты программы</a>';
if(focus){document.querySelector('main').focus({preventScroll:true});scrollTo(0,0);}
}
function modal(title,body,action,label){const d=document.querySelector('#stage1Dialog');d.innerHTML='<button class="close" data-action="close" aria-label="Закрыть">×</button><h2 id="dialogTitle">'+title+'</h2><p>'+body+'</p><div class="row">'+btn(label,action)+btn('Отмена','close',true)+'</div>';d.showModal();}
function mutate(action,next){if(busy)return;busy=true;log(action);render();setTimeout(()=>{busy=false;go(next);},120);}
async function copy(){
const input=document.querySelector('#inviteLink');const status=document.querySelector('#copyStatus');
try{await navigator.clipboard.writeText(input.value);status.textContent='Ссылка скопирована. Отправьте её партнёру лично.';}
catch{input.focus();input.select();status.textContent='Ссылка выделена. Скопируйте её вручную.';}
}
document.addEventListener('change',e=>{
if(e.target.id==='viewSelect')go(e.target.value);
if(e.target.id==='consentInput'){agreed=e.target.checked;const b=document.querySelector('[data-action=consent]');if(b)b.disabled=!agreed;}
});
document.addEventListener('click',e=>{
const legalLink=e.target.closest('[data-legal]');if(legalLink){e.preventDefault();modal('Юридические страницы','В рабочем сайте используется действующая страница '+escape(legalLink.getAttribute('href'))+'. Этот макет не заменяет её текст.','close','Понятно');return;}
const role=e.target.closest('[data-role]');if(role){actor=role.dataset.role;logged=false;authReady=false;agreed=false;if(actor==='partner'&&view==='invite')go('public');else if(actor==='initiator'&&view==='requested')go('confirm');else render();return;}
const b=e.target.closest('[data-action]');if(!b||b.disabled)return;e.preventDefault();
switch(b.dataset.action){
case 'start':provider="";actor='initiator';go('login');break;
case 'home':go('start');break;case 'reset':location.href='?view=start';break;
case 'consent':if(!agreed)return;log('consent');authReady=true;render();break;
case 'login-vk':logged=true;log(b.dataset.action);go(actor==='partner'?'public':'create');break;
case 'create':hadLink=true;mutate('create-space','invite');break;
case 'copy':copy();break;case 'refresh-invite':announce('В макете пока нет нового запроса.');document.querySelector('#copyStatus').textContent='Пока ждём запрос партнёра.';break;
case 'reissue-warning':modal('Выпустить новое приглашение?','Прежняя ссылка перестанет работать. Новую нужно отправить партнёру.','reissue','Да, выпустить новую');break;
case 'reissue':document.querySelector('#stage1Dialog').close();inviteRevision++;inviteURL='https://grani.example/together/invite/demo-example-'+inviteRevision;hadLink=true;mutate('reissue-invite','invite');break;
case 'join-start':if(!logged){actor='partner';provider="invite";go('login');}else mutate('request-join','requested');break;
case 'check-request':announce('В макете подтверждение ещё ожидается.');break;
case 'accept':mutate('confirm-accepted','ready');break;
case 'decline':mutate('confirm-declined',hadLink?'invite':'lost');break;
case 'checkout':go('checkout');break;case 'ready':go('ready');break;
case 'return-payment':go('waiting');break;case 'cancel-payment':go('cancelled');break;
case 'poll':log('check-purchase');go('success');break;
case 'poll-delayed':log('check-paid-access');announce('Платёж подтверждён. Доступ в макете ещё проверяется.');break;
case 'paid':go('paid');break;case 'retry':go('waiting');break;
case 'preview-intro':modal('Первый вопрос для двоих','«Какой небольшой поступок партнёра за последнее время вас порадовал?» Это пример следующего этапа; здесь реальные ответы не собираются.','close','Понятно');break;
case 'leave-warning':{
const d=document.querySelector('#stage1Dialog');d.innerHTML='<button class="close" data-action="close" aria-label="Закрыть">×</button><h2 id="dialogTitle">Выйти из пространства?</h2><p>Совместная программа и доступ прекратятся для обоих. Остаток срока не возвращается и не переносится автоматически.</p><label class="s1-check" style="margin:20px 0"><input id="leaveAcknowledged" type="checkbox"><span>Я понимаю последствия выхода.</span></label><div class="row">'+btn('Выйти из пространства','leave',false,true)+btn('Остаться','close',true)+'</div>';d.showModal();break;}
case 'leave':if(!document.querySelector('#leaveAcknowledged')?.checked)return;document.querySelector('#stage1Dialog').close();mutate('leave-acknowledged','left');break;
case 'close':document.querySelector('#stage1Dialog').close();break;
}
});
document.addEventListener('change',e=>{if(e.target.id==='leaveAcknowledged')document.querySelector('[data-action=leave]').disabled=!e.target.checked;});
document.addEventListener('submit',e=>{if(e.target.id!=='paymentForm')return;e.preventDefault();email=document.querySelector('#receiptEmail').value.trim();if(!e.target.reportValidity()||!email)return;mutate('start-purchase','gateway');});
document.addEventListener('input',e=>{if(e.target.id==='receiptEmail')email=e.target.value;});
window.stage1Demo={setPendingName(name){pendingName=String(name);render();},currentView(){return view;}};
render();
})();
