export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('plately.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
