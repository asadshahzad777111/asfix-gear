import { SHOP } from '../config/shop';

import { useTranslation } from '../context/LanguageContext';



const MARQUEE_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];



export default function Marquee() {

  const { t } = useTranslation();

  const items = MARQUEE_KEYS.map((key) => t(`marquee.${key}`));

  const track = [...items, ...items];



  return (

    <div className="marquee-wrap" aria-hidden="true">

      <div className="marquee-track">

        {track.map((item, i) => (

          <span key={i} className="marquee-item">

            {item} <span className="marquee-dot">✦</span>

          </span>

        ))}

      </div>

    </div>

  );

}



export function MarqueeStatic() {

  return null;

}

