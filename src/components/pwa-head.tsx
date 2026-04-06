import { applePwaSplashStartupImages } from '@/lib/splash-screens';

export default function PwaHead() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBeforePaintScript }} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta
        name="apple-mobile-web-app-status-bar-style"
        content="black-translucent"
      />
      {applePwaSplashStartupImages.map((img, i) => (
        <link
          key={i}
          rel="apple-touch-startup-image"
          href={img.url}
          media={img.media}
        />
      ))}
    </>
  );
}

const themeBeforePaintScript = `
(function(){
  try {
    var d=document.documentElement;
    var t=localStorage.getItem('theme');
    if(t==='dark'){d.classList.add('dark');}
    else if(t==='light'){d.classList.remove('dark');}
    else if(window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark');}
  } catch(_){}
})();
`;
