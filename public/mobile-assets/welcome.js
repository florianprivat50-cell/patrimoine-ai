'use strict';
// Presentation only: existing Identity, account storage and analysis remain unchanged.
(() => {
  const landing = document.createElement('section');
  landing.id = 'welcome';
  landing.className = 'welcome-screen';
  landing.setAttribute('aria-labelledby', 'welcome-title');
  landing.innerHTML = `
    <header class="welcome-header"><a class="welcome-brand" href="#accueil" aria-label="Patrimoine AI, accueil"><img src="/icon.svg" width="30" height="30" alt=""><span>patrimoine <b>AI</b></span></a><a class="welcome-login" href="#connexion">Connexion</a></header>
    <div class="welcome-visual" aria-hidden="true"><div class="welcome-mosaic">
      <div class="welcome-column"><img src="/mobile-assets/preview-finance.webp" alt="" width="618" height="690"><img src="/mobile-assets/preview-result.webp" alt="" width="618" height="770"></div>
      <div class="welcome-column"><img src="/mobile-assets/preview-result.webp" alt="" width="618" height="770"><img src="/mobile-assets/preview-finance.webp" alt="" width="618" height="690"></div>
      <div class="welcome-column"><img src="/mobile-assets/preview-finance.webp" alt="" width="618" height="690"><img src="/mobile-assets/preview-result.webp" alt="" width="618" height="770"></div>
    </div></div>
    <div class="welcome-copy"><p class="welcome-kicker">L’IMMOBILIER, EN PLUS CLAIR.</p><h1 id="welcome-title">De belles idées.<br><em>Les bons chiffres.</em></h1><p class="welcome-description">Le bien, le lieu, le financement.<br>Tout pour éclairer votre prochaine décision.</p><a class="welcome-cta" href="#connexion">Accéder à mon espace</a><p class="welcome-signup">Votre premier projet ? <a href="#inscription">Créer un compte</a></p><p class="welcome-caption">Aperçus fictifs · version de test</p></div>
    <div class="welcome-intro" aria-hidden="true"><img src="/icon.svg" width="84" height="84" alt=""><p>patrimoine <b>AI</b></p><span>Vos projets prennent forme.</span></div>`;
  document.body.prepend(landing);
  const back = document.createElement('a');
  back.href = '#accueil'; back.className = 'welcome-back'; back.textContent = 'Retour à l’accueil';
  document.querySelector('#auth-gate').prepend(back);
  let current = {user:null,ready:false};
  const authRoute = () => /^#(connexion|inscription)$/.test(location.hash) || /(?:recovery|invite|confirmation|access)_token=/.test(location.hash);
  let introSeen = false;
  try { introSeen = sessionStorage.getItem('pia-welcome-intro') === '1'; } catch {}
  let introTimer;
  function finishIntro(){clearTimeout(introTimer);landing.classList.remove('intro-playing');}
  function update(account, demo){
    current = account;
    const show = !demo && !account.user && !account.resetPassword && !account.invite && !authRoute();
    landing.hidden = !show;
    document.body.classList.toggle('welcome-open',show);
    if(!show)finishIntro();
  }
  function route(){
    finishIntro();
    if(location.hash === '#connexion' || location.hash === '#inscription') {
      window.dispatchEvent(new CustomEvent('pia:welcome-auth',{detail:location.hash === '#inscription'?'signup':'login'}));
      requestAnimationFrame(()=>document.querySelector('#auth-email')?.focus({preventScroll:true}));
    } else if(location.hash === '#accueil') {
      window.dispatchEvent(new Event('pia:welcome-home'));
      document.querySelector('#welcome-title').setAttribute('tabindex','-1');
      document.querySelector('#welcome-title').focus({preventScroll:true});
    }
  }
  window.piaWelcome = {update};
  addEventListener('hashchange',route);
  update(current,false);
  if(!authRoute()&&!introSeen&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    landing.classList.add('intro-playing');
    try{sessionStorage.setItem('pia-welcome-intro','1');}catch{}
    introTimer=setTimeout(finishIntro,1500);
    // Never trap keyboard or pointer navigation behind an intro.
    landing.addEventListener('pointerdown',finishIntro,{once:true});
    addEventListener('keydown',finishIntro,{once:true});
  }
})();
