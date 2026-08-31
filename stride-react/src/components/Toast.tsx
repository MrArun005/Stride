import { useEffect, useState } from 'react';
import { data, useStore } from '../store';

export default function Toast() {
  useStore();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!data.toastN) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, [data.toastN]);
  return <div className={'toast' + (show ? ' show' : '')}>{data.toastMsg}</div>;
}
