'use client';
import { useEffect, useRef, useState } from 'react';

/* Country → State/Province → City, cascading.
 *
 * Uses the same native <select> the rest of the form uses, so the field
 * height, radius, focus ring and error styling are inherited rather than
 * re-created. Native selects also give free keyboard type-ahead, which is the
 * "searchable" behaviour without adding a component library.
 *
 * Each level degrades to a text input when the dataset has nothing for it —
 * some countries have no sub-divisions, and the geo API answers `free: true`
 * rather than showing an empty dropdown nobody can get past.
 *
 * Both the readable name and the code are stored: the name is what a human
 * reads on the review page and in admin, the code is what the next level
 * queries with, and keeping only one of them would mean re-deriving the other.
 */
export default function AddressSelect({ f, set, blur, showErr, Field, Select, Input }) {
  const [countries, setCountries] = useState(null);
  const [states, setStates] = useState({ list: null, free: false });
  const [cities, setCities] = useState({ list: null, free: false });

  // A slow states request for a country the applicant has already changed away
  // from must not overwrite the current list.
  const req = useRef(0);

  useEffect(() => {
    fetch('/api/public/geo?type=countries', { cache: 'force-cache' })
      .then(r => r.json()).then(j => setCountries(j?.ok ? j.list : []))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!f.current_country_code) { setStates({ list: [], free: false }); return; }
    const id = ++req.current;
    setStates({ list: null, free: false });
    fetch(`/api/public/geo?type=states&country=${f.current_country_code}`, { cache: 'force-cache' })
      .then(r => r.json())
      .then(j => { if (id === req.current) setStates({ list: j?.list || [], free: !!j?.free }); })
      .catch(() => { if (id === req.current) setStates({ list: [], free: true }); });
  }, [f.current_country_code]);

  useEffect(() => {
    if (!f.current_country_code || !f.current_state_code) { setCities({ list: [], free: false }); return; }
    const id = ++req.current;
    setCities({ list: null, free: false });
    fetch(`/api/public/geo?type=cities&country=${f.current_country_code}&state=${encodeURIComponent(f.current_state_code)}`,
      { cache: 'force-cache' })
      .then(r => r.json())
      .then(j => { if (id === req.current) setCities({ list: j?.list || [], free: !!j?.free }); })
      .catch(() => { if (id === req.current) setCities({ list: [], free: true }); });
  }, [f.current_country_code, f.current_state_code]);

  // Changing a level clears everything below it, so a stale city can never be
  // submitted against a country it does not belong to.
  const pickCountry = (name) => {
    const c = (countries || []).find(x => x.name === name);
    set('__address', {
      current_country: name, current_country_code: c?.code || '',
      current_state_province: '', current_state_code: '', current_city: '',
    });
  };
  const pickState = (name) => {
    const s = (states.list || []).find(x => x.name === name);
    set('__address', {
      current_state_province: name, current_state_code: s?.code || name, current_city: '',
    });
  };

  const loadingStates = !!f.current_country_code && states.list === null;
  const loadingCities = !!f.current_state_code && cities.list === null;
  const stateFree = states.free && !!f.current_country_code;
  const cityFree = cities.free && !!f.current_state_code;

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <Field label="Country" req error={showErr('current_country')}>
        <Select value={f.current_country} onChange={pickCountry}
          options={(countries || []).map(c => c.name)}
          placeholder={countries === null ? 'Loading…' : '— select —'}
          disabled={countries === null}
          onBlur={() => blur('current_country')} bad={!!showErr('current_country')} />
      </Field>

      <Field label="State / Province" req error={showErr('current_state_province')}>
        {stateFree
          ? <Input value={f.current_state_province}
              onChange={v => set('__address', { current_state_province: v, current_state_code: v, current_city: '' })}
              placeholder="Type your state or province"
              onBlur={() => blur('current_state_province')} bad={!!showErr('current_state_province')} />
          : <Select value={f.current_state_province} onChange={pickState}
              options={(states.list || []).map(s => s.name)}
              placeholder={!f.current_country_code ? '— choose a country first —'
                : loadingStates ? 'Loading…' : '— select —'}
              disabled={!f.current_country_code || loadingStates}
              onBlur={() => blur('current_state_province')} bad={!!showErr('current_state_province')} />}
      </Field>

      <Field label="City" req error={showErr('current_city')}>
        {cityFree
          ? <Input value={f.current_city} onChange={v => set('current_city', v)}
              placeholder="Type your city"
              onBlur={() => blur('current_city')} bad={!!showErr('current_city')} />
          : <Select value={f.current_city} onChange={v => set('current_city', v)}
              options={(cities.list || []).map(c => c.name)}
              placeholder={!f.current_state_code ? '— choose a state first —'
                : loadingCities ? 'Loading…' : '— select —'}
              disabled={!f.current_state_code || loadingCities}
              onBlur={() => blur('current_city')} bad={!!showErr('current_city')} />}
      </Field>
    </div>
  );
}
