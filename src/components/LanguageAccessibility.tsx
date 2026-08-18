import {Languages,Pause,Play,Square} from "lucide-react";
import {useEffect,useState} from "react";

const languages=[
  ["en","English","en-IN"],["hi","हिन्दी","hi-IN"],["mr","मराठी","mr-IN"],["bn","বাংলা","bn-IN"],
  ["ta","தமிழ்","ta-IN"],["te","తెలుగు","te-IN"],["gu","ગુજરાતી","gu-IN"],["pa","ਪੰਜਾਬੀ","pa-IN"],
  ["kn","ಕನ್ನಡ","kn-IN"],["ml","മലയാളം","ml-IN"],["or","ଓଡ଼ିଆ","or-IN"],["as","অসমীয়া","as-IN"],
  ["ur","اردو","ur-IN"],["mai","मैथिली","mai-IN"]
] as const;

const savedLanguage=()=>document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([^;]+)/)?.[1]||localStorage.getItem("vj-language")||"en";

export function LanguageAccessibility({path}:{path:string}){
  const[language,setLanguage]=useState(savedLanguage),[speaking,setSpeaking]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    (window as any).googleTranslateElementInit=()=>new (window as any).google.translate.TranslateElement({pageLanguage:"en",includedLanguages:languages.map(x=>x[0]).join(","),autoDisplay:false},"google_translate_element");
    if(!document.querySelector('script[data-vj-translate]')){const script=document.createElement("script");script.src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";script.async=true;script.dataset.vjTranslate="true";document.body.appendChild(script)}
  },[]);
  useEffect(()=>{window.speechSynthesis?.cancel();setSpeaking(false);setPaused(false)},[path]);
  useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
  const changeLanguage=(code:string)=>{localStorage.setItem("vj-language",code);const value=code==="en"?"":`/en/${code}`,age=code==="en"?0:31536000;document.cookie=`googtrans=${value};path=/;max-age=${age}`;document.cookie=`googtrans=${value};path=/;domain=.${location.hostname};max-age=${age}`;location.reload()};
  const read=()=>{if(!("speechSynthesis" in window))return;if(speaking){if(paused){speechSynthesis.resume();setPaused(false)}else{speechSynthesis.pause();setPaused(true)}return}const target=document.querySelector("main article, main") as HTMLElement|null,text=target?.innerText.replace(/\s+/g," ").trim();if(!text)return;const u=new SpeechSynthesisUtterance(text),locale=languages.find(x=>x[0]===language)?.[2]||"en-IN";u.lang=locale;u.rate=.92;u.onend=u.onerror=()=>{setSpeaking(false);setPaused(false)};const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(locale.slice(0,2).toLowerCase()));if(voice)u.voice=voice;speechSynthesis.speak(u);setSpeaking(true)};
  const stop=()=>{window.speechSynthesis?.cancel();setSpeaking(false);setPaused(false)};
  return <aside className="language-tools glass" aria-label="Language and reading tools"><div className="language-picker"><Languages/><label htmlFor="site-language">Language</label><select id="site-language" value={language} onChange={e=>changeLanguage(e.target.value)} aria-label="Translate website">{languages.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div><button type="button" onClick={read} aria-label={speaking&&!paused?"Pause reading":"Read page aloud"}>{speaking&&!paused?<Pause/>:<Play/>}<span>{speaking?(paused?"Resume":"Pause"):"Read aloud"}</span></button>{speaking&&<button type="button" className="read-stop" onClick={stop} aria-label="Stop reading"><Square/><span>Stop</span></button>}<div id="google_translate_element" aria-hidden="true"/></aside>
}
