import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input,button,textarea')?.focus();
    function keys(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const fields = [
          ...ref.current.querySelectorAll('button,input,textarea,select,a[href]'),
        ].filter((x) => !x.disabled);
        if (!fields.length) return;
        if (e.shiftKey && document.activeElement === fields[0]) {
          e.preventDefault();
          fields.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === fields.at(-1)) {
          e.preventDefault();
          fields[0].focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={'modal ' + (wide ? 'wide' : '')}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
