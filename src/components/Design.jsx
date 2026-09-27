import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
export default function Design({ version }) {
  const frame = useRef(),
    content = useRef();
  const [size, setSize] = useState({ width: 840, height: 570 });
  useLayoutEffect(() => {
    const measure = () =>
      setSize({ width: frame.current.clientWidth, height: content.current.offsetHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    observer.observe(content.current);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="design-frame" ref={frame} style={{ height: (size.height * size.width) / 840 }}>
      <div
        className="design-content"
        ref={content}
        style={{ width: 840, transform: `scale(${size.width / 840})`, transformOrigin: 'top left' }}
      >
        <div className={'design ' + version}>
          <div className="site-nav">
            <b>
              forma<span>®</span>
            </b>
            <div>
              Our work　 Studio　 Journal <span className="site-contact">Let’s talk ↗</span>
            </div>
          </div>
          <div className="site-hero">
            <div className="eyebrow">INDEPENDENT DESIGN STUDIO · EST. 2021</div>
            <h2>
              Good things
              <br />
              take <em>shape.</em>
            </h2>
            <p>
              We build thoughtful brands and digital experiences
              <br />
              for people moving the world forward.
            </p>
            <span className="site-cta">
              Explore our work <ArrowUpRight size={14} />
            </span>
            <div className="sculpture">
              <div className="sculpture-a" />
              <div className="sculpture-b" />
              <div className="sculpture-c" />
            </div>
            <span className="art-caption">
              FORM STUDY / 002
              <br />A balance of intention and instinct.
            </span>
          </div>
          <div className="project-strip">
            <span>SELECTED PARTNERS</span>
            <b>offscript.</b>
            <b>Arc & Co</b>
            <b>morrow</b>
            <b>STILL</b>
          </div>
          <div className="site-bottom">
            <span>
              Small team.
              <br />
              <strong>Considered impact.</strong>
            </span>
            <div>
              <small>
                {version === 'v2' ? 'CLEAR SCOPE. NO SURPRISES.' : 'LET’S BUILD SOMETHING GOOD.'}
              </small>
              <h3>
                {version === 'v2' ? 'Brand packages from $2,400' : 'A partnership, not a project.'}
              </h3>
              <p>
                {version === 'v2'
                  ? 'Strategy, identity, and a confident first impression.'
                  : 'Made around your ambition. Built to last.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
