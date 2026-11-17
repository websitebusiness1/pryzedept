import { Link } from 'react-router-dom';
import { config } from '@/config';
import Logo from '@/components/Logo';

const manage = [
  ['Products & photos', 'Add pieces with several photos each, sizes, colors and stock. Choose the cover and the order.'],
  ['Lookbooks', 'Upload photoshoots, write the story, set a cover and arrange the photos.'],
  ['Videos', 'Upload a video or paste a YouTube or Vimeo link, with your own thumbnail.'],
  ['Homepage', 'Change the banner, headings and sections. Show, hide and reorder them.'],
  ['Fonts', 'Pick the heading, body, navigation and button fonts from Google Fonts.'],
  ['Orders & stock', 'See every order, update fulfillment, confirm payments and track inventory.'],
];

const steps = [
  ['We build your website', 'A custom design made for your brand, not a template.'],
  ['You get an admin', 'Your own private login to manage everything on the website.'],
  ['Preview before it’s live', 'Check changes on desktop, tablet and mobile first.'],
  ['Publish when ready', 'Drafts stay hidden. Only what you publish appears.'],
];

export default function Home() {
  const { platformName, contactEmail, contactPhone, facebookUrl, instagramUrl } = config;
  const mailto = contactEmail ? `mailto:${contactEmail}?subject=${encodeURIComponent('Website inquiry for my clothing brand')}` : '';
  const hasContact = Boolean(contactEmail || contactPhone || facebookUrl || instagramUrl);

  return (
    <div className="bg-black text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo onDark />
        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-5">
          <a href="#manage" className="hidden px-2 py-2 text-white/65 hover:text-white sm:inline">What you manage</a>
          <a href="#how" className="hidden px-2 py-2 text-white/65 hover:text-white sm:inline">How it works</a>
          <a href="#contact" className="hidden px-2 py-2 text-white/65 hover:text-white sm:inline">Contact</a>
          <Link to="/login" className="border border-white px-4 py-2 font-semibold hover:bg-white hover:text-black">Sign in</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <img src="/pryze-mark-white.png" alt="" aria-hidden className="pointer-events-none absolute -right-24 top-4 w-[38rem] max-w-none opacity-[0.07] sm:right-0 sm:w-[48rem]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-16 sm:pb-36 sm:pt-28">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/55">Websites for clothing brands</p>
          <h1 className="font-display mt-6 max-w-4xl text-[clamp(3rem,10vw,8rem)] leading-[0.9]" style={{ fontWeight: 900 }}>
            Your brand. Your website. One admin.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/70">
            {platformName} builds custom websites for clothing brands, then gives you an admin to run them: products, photoshoots, lookbooks, videos, fonts and orders, without touching code.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#contact" className="bg-white px-7 py-3.5 font-semibold text-black hover:bg-white/85">Start your website</a>
            <Link to="/login" className="border border-white/50 px-7 py-3.5 font-semibold hover:border-white">Brand sign in</Link>
          </div>
        </div>
      </section>

      <section id="manage" className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <h2 className="font-display max-w-2xl text-4xl sm:text-6xl" style={{ fontWeight: 900 }}>Everything you manage yourself</h2>
          <dl className="mt-14 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
            {manage.map(([title, body]) => (
              <div key={title} className="bg-black p-7">
                <dt className="font-display text-xl">{title}</dt>
                <dd className="mt-3 text-sm leading-relaxed text-white/65">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="how" className="border-t border-white/15 bg-white text-black">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <h2 className="font-display text-4xl sm:text-6xl" style={{ fontWeight: 900 }}>How it works</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-4">
            {steps.map(([title, body], i) => (
              <li key={title} className="border-t-2 border-black pt-5">
                <span className="font-display text-sm tracking-widest text-sand-500">0{i + 1}</span>
                <h3 className="font-display mt-2 text-xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-sand-500">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 max-w-xl text-sm text-sand-500">Pricing and payments are agreed with us directly. There is no automatic billing.</p>
        </div>
      </section>

      <section id="contact" className="border-t border-white/15">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:py-28 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl leading-none sm:text-6xl" style={{ fontWeight: 900 }}>Let’s build yours.</h2>
            <p className="mt-6 max-w-md leading-relaxed text-white/65">Tell us about your brand and what you sell. We’ll reply with what we’d build and what it costs.</p>
          </div>
          <div className="flex flex-col justify-end gap-4 md:items-start">
            {mailto && <a href={mailto} className="bg-white px-7 py-3.5 font-semibold text-black hover:bg-white/85">Email {contactEmail}</a>}
            {contactPhone && <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="text-lg underline underline-offset-4">{contactPhone}</a>}
            {(facebookUrl || instagramUrl) && (
              <div className="flex gap-5 text-white/80">
                {facebookUrl && <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Facebook</a>}
                {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Instagram</a>}
              </div>
            )}
            {!hasContact && <p className="text-white/55">Contact details will appear here soon.</p>}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <Logo onDark size="sm" />
          <p>© {new Date().getFullYear()} {platformName}</p>
        </div>
      </footer>
    </div>
  );
}
