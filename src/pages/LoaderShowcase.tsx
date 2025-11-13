import Loader from '../components/Loader'
import tzMap from '../assets/tz-map.svg'

const THEME_BAR_OFFSETS = [22, 34, 46, 58]

const LoaderShowcase = () => {
  return (
    <div className="loader-gallery">
      <header className="loader-gallery__intro">
        <p className="loader-gallery__eyebrow">Loader concepts</p>
        <h1>tzCIS Loading Explorations</h1>
        <p>
          A sandbox of motion ideas for the home experience. Compare each direction side-by-side
          before we pick a final loader for launch.
        </p>
      </header>

      <section className="loader-gallery__grid">
        <article className="loader-card">
          <div className="loader-card__header">
            <h2>Supersized crest</h2>
            <p>Hero map takes center stage with the caption tucked underneath.</p>
          </div>
          <div className="loader-card__preview">
            <div className="loader-variant loader-variant--heroMap">
              <img src={tzMap} alt="Tanzania outline, large hero treatment" />
              <span>Preparing insights</span>
            </div>
          </div>
        </article>

        <article className="loader-card">
          <div className="loader-card__header">
            <h2>Gradient pulse</h2>
            <p>Tanzanian map rendered via CSS mask with a constantly shifting linear gradient.</p>
          </div>
          <div className="loader-card__preview">
            <div className="loader-variant loader-variant--gradientMap">
              <div className="loader-gradientMap__shape" aria-hidden="true" />
              <span className="loader-gradientMap__label">Live data stream</span>
            </div>
          </div>
        </article>

        <article className="loader-card">
          <div className="loader-card__header">
            <h2>Current loader</h2>
            <p>The production loader embedded as-is for quick comparison.</p>
          </div>
          <div className="loader-card__preview loader-card__preview--padded loader-card__preview--current">
            <Loader message="Loading Google Sheets data…" />
          </div>
        </article>

        <article className="loader-card">
          <div className="loader-card__header">
            <h2>Theme-forward map</h2>
            <p>Applies tzCIS brand colors with a subtle glow and ticker bars.</p>
          </div>
          <div className="loader-card__preview">
            <div className="loader-variant loader-variant--themeMap">
              <div className="loader-themeMap">
                <div className="loader-themeMap__halo" aria-hidden="true" />
                <div className="loader-themeMap__map" aria-hidden="true">
                  {THEME_BAR_OFFSETS.map((offset, idx) => (
                    <span
                      key={`theme-bar-${idx}`}
                      className="loader-themeMap__bar"
                      style={{ animationDelay: `${idx * 0.16}s`, left: `${offset}%` }}
                    />
                  ))}
                </div>
                <div className="loader-themeMap__meta">
                  <span>Stitching live feeds</span>
                  <strong>Calibrating dashboards…</strong>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}

export default LoaderShowcase
