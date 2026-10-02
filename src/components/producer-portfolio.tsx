import { BeatCatalog } from "@/components/beat-catalog";

const instagram = "https://www.instagram.com/yearofziova/";

export function ProducerPortfolio() {
  return (
    <>
      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-topline eyebrow"><span>YEAR OF ZIOVA</span><span>PRODUCER / BEATMAKER</span></div>
        <div className="hero-copy">
          <p className="eyebrow hero-intro">A LITTLE FEELING. A LOT OF SOUND.</p>
          <h1 id="hero-title">a sound of<br /><span>my own.</span><sup aria-hidden="true">✳</sup></h1>
          <div className="hero-description">
            <p>I’m ziova. I make beats.<br />You make them your own.</p>
            <a href="#beats" className="primary-link">Explore the beats <span aria-hidden="true">↘</span></a>
          </div>
        </div>
        <div className="hero-bottom eyebrow"><span>BEATS & ORIGINAL PRODUCTION</span><a href="#beats">SCROLL TO LISTEN <span aria-hidden="true">↓</span></a></div>
      </section>

      <BeatCatalog />
      <BeatCatalog kind="loops" />

      <section id="about" className="about-section section-shell">
        <div className="about-label"><span className="eyebrow">03 / THE PRODUCER</span><span className="about-signature">ziova.</span></div>
        <div className="about-copy"><h2>Behind every beat,<br />a point of view.</h2>
          <p>This is my corner of the internet. A place for the sounds I make and the ideas that come next.</p>
          <p>Looking for a beat, building a project, or hearing something different? Let’s make it happen.</p>
          <a href={instagram} target="_blank" rel="noreferrer" className="text-link">Find me @yearofziova <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section id="contact" className="contact-section section-shell">
        <span className="eyebrow">04 / YOUR NEXT IDEA</span>
        <div className="contact-heading"><h2>let’s make<br /><span>something.</span></h2>
          <a href={instagram} target="_blank" rel="noreferrer" className="contact-arrow" aria-label="Contact Ziova on Instagram">↗</a>
        </div>
        <div className="contact-bottom"><p>Beats, loops, or a conversation.<br />DM me on Instagram for inquiries.</p>
          <a href={instagram} target="_blank" rel="noreferrer" className="text-link">@yearofziova <span aria-hidden="true">↗</span></a>
        </div>
      </section>
      <footer className="site-footer section-shell eyebrow"><span>© {new Date().getFullYear()} ZIOVA</span><span>MADE TO BE FELT.</span><a href="#top">BACK TO TOP ↑</a></footer>
    </>
  );
}
