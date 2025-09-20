'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Service Report – Single-file Next.js page component
 * - Print to PDF via window.print()
 * - Photos under FINDINGS: first page 2 photos, subsequent pages 4 per page (2×2)
 * - Square borders, navy headers, thinner centred title banner
 * - Save/Load to localStorage with key <VESSELNAME><DDMMYY>
 * - Saved reports dropdown with first-photo thumbnail preview
 * - Optional DOCX export (dynamic import; requires `npm i docx` in the host project)
 */

// -----------------------------
// Company profiles
// -----------------------------
const COMPANIES = {
  IMI: {
    name: 'IMI CORPORATION PTE. LTD.',
    address1: 'No. 13, Joo Koon Crescent, Singapore 629021',
    contact: 'Tel: (65) 6861 4222 | Fax: (65) 6862 4222',
    web: 'sales@imicorp.com.sg | www.imicorp.com.sg',
    reg: 'Co. Reg. No.: 199205115N | GST No.: M2-0109564-6',
    logoUrl: 'https://imicorp.com.sg/wp-content/uploads/2025/09/logo-small.png',
  },
  ITI: {
    name: 'I.T.I. CORPORATION PTE. LTD.',
    address1: 'No. 13, Joo Koon Crescent, Singapore 629021',
    contact: 'Tel: (65) 6861 4222 | Fax: (65) 6862 4222',
    web: 'sales@imicorp.com.sg | www.imicorp.com.sg',
    reg: 'Co. Reg. No.: 197801784E | GST No.: M200315839',
    logoUrl: 'https://imicorp.com.sg/wp-content/uploads/2025/09/ITI-CORPORATION-LOGO.png',
  },
} as const;

type CompanyId = keyof typeof COMPANIES;

type Photo = { id: string; src: string; caption: string };

// -----------------------------
// Helpers + lightweight runtime tests
// -----------------------------
function computeStorageKey(vessel: string, baseISO: string) {
  const vesselKey = (vessel || 'VESSEL').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const dt = new Date(baseISO);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(-2);
  return `${vesselKey}${dd}${mm}${yy}`;
}

function paginatePhotos(arr: Photo[]) {
  const firstTwo = arr.slice(0, 2);
  const rest = arr.slice(2);
  const groups: Photo[][] = [];
  for (let i = 0; i < rest.length; i += 4) groups.push(rest.slice(i, i + 4));
  return { firstTwo, groups };
}

function safeInnerText(el: HTMLElement | null | undefined) {
  try {
    return el?.innerText ?? '';
  } catch {
    return '';
  }
}

export default function ServiceReportApp() {
  // -----------------------------
  // Form state
  // -----------------------------
  const [form, setForm] = useState({
    companyId: 'IMI' as CompanyId,
    reportType: 'SERVICE REPORT',
    customer: '',
    vessel: '',
    referenceNo: '',
    jobNumber: '',
    jobDateStart: '',
    jobDateEnd: '',
    location: '',
    serviceTypes: ['Troubleshooting'] as string[],
    serviceTypeOther: '',
    equipmentMakeModel: '',
    findings: '',
    summary: '',
    recommendations: '',
    preparedBy: '',
    logoUrl: COMPANIES.IMI.logoUrl,
  });

  const [logoTouched, setLogoTouched] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const company = useMemo(() => COMPANIES[form.companyId], [form.companyId]);

  useEffect(() => {
    // Update logo when switching company (unless user typed a custom one)
    if (!logoTouched && company.logoUrl) setForm((f) => ({ ...f, logoUrl: company.logoUrl }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.companyId]);

  const todayStr = useMemo(() => new Date().toLocaleDateString(), []);

  // -----------------------------
  // Photos (screen form)
  // -----------------------------
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setPhotos((prev) => [
          ...prev,
          { id: Math.random().toString(36).slice(2), src: String(reader.result), caption: '' },
        ]);
      reader.readAsDataURL(file);
    });
    e.currentTarget.value = '';
  };

  const movePhoto = (idx: number, dir: -1 | 1) =>
    setPhotos((prev) => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const { firstTwo, groups: groupsOfFour } = useMemo(() => paginatePhotos(photos), [photos]);

  // -----------------------------
  // Derived display
  // -----------------------------
  const serviceTypeDisplay = useMemo(() => {
    const list = [...form.serviceTypes];
    const idx = list.indexOf('Others');
    if (idx !== -1 && form.serviceTypeOther) list[idx] = `Others: ${form.serviceTypeOther}`;
    return list.join(', ');
  }, [form.serviceTypes, form.serviceTypeOther]);

  const handleChange: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  > = (e) => {
    const { name, value } = e.target;
    if (name === 'logoUrl') setLogoTouched(true);
    setForm((f) => ({ ...f, [name]: value }));
  };

  // -----------------------------
  // Local storage save/load using key <VESSELNAME><DDMMYY>
  // -----------------------------
  const storageKey = useMemo(() => {
    const baseISO = form.jobDateEnd || form.jobDateStart || new Date().toISOString().slice(0, 10);
    return computeStorageKey(form.vessel, baseISO);
  }, [form.vessel, form.jobDateEnd, form.jobDateStart]);

  const [saveMsg, setSaveMsg] = useState('');
  const [savedList, setSavedList] = useState<{ key: string; label: string; preview?: string }[]>([]);
  const [selectedSavedKey, setSelectedSavedKey] = useState('');

  // Populate saved-list on mount
  useEffect(() => {
    try {
      const items: { key: string; label: string; preview?: string }[] = [];
      for (let i = 0; i < (typeof localStorage !== 'undefined' ? localStorage.length : 0); i++) {
        const key = localStorage.key(i) || '';
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const data = JSON.parse(raw);
          if (!data || typeof data !== 'object') continue;
          const preview = Array.isArray(data?.photos) && data.photos[0]?.src ? data.photos[0].src : undefined;
          items.push({ key, label: key, preview });
        } catch {}
      }
      items.sort((a, b) => (a.key < b.key ? 1 : -1));
      setSavedList(items);
      if (!selectedSavedKey && items[0]) setSelectedSavedKey(items[0].key);
    } catch {}
  }, []);

  const saveToStorage = () => {
    try {
      const data = { form, photos };
      localStorage.setItem(storageKey, JSON.stringify(data));
      setSaveMsg(`Saved as ${storageKey}`);
      setSelectedSavedKey(storageKey);
      // quick refresh in dropdown
      const preview = photos[0]?.src;
      setSavedList((prev) => [{ key: storageKey, label: storageKey, preview }, ...prev.filter((i) => i.key !== storageKey)]);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Save failed (data too large).');
    }
  };

  const loadFromStorage = (key?: string) => {
    try {
      const k = key || selectedSavedKey || storageKey;
      const raw = localStorage.getItem(k);
      if (!raw) {
        setSaveMsg('No saved data for this key');
        return;
      }
      const data = JSON.parse(raw);
      if (data.form) setForm((prev) => ({ ...prev, ...data.form, recommendations: (data.form as any).recommendations ?? prev.recommendations ?? '' }));
      if (data.photos) setPhotos(data.photos);
      setSaveMsg(`Loaded ${k}`);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Load failed.');
    }
  };

  const printPDF = () => window.print();

  // Optional DOCX export
  const saveAsDocx = async () => {
    try {
      const mod: any = await import('docx');
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = mod;
      const labelValue = (label: string, value?: string) =>
        new Paragraph({ children: [new TextRun({ text: label + ': ', bold: true }), new TextRun(value || '')] });
      const jobDate = form.jobDateStart || form.jobDateEnd
        ? `${form.jobDateStart || ''}${form.jobDateEnd ? ` to ${form.jobDateEnd}` : ''}`
        : '';
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: form.reportType, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: COMPANIES[form.companyId].name }),
            new Paragraph({ text: '' }),
            labelValue('Customer', form.customer),
            labelValue('Vessel', form.vessel),
            labelValue('Reference No.', form.referenceNo),
            labelValue('Job Number', form.jobNumber),
            labelValue('Job Date', jobDate),
            labelValue('Location', form.location),
            labelValue('Service Types', serviceTypeDisplay),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'FINDINGS', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: form.findings || '' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: 'SUMMARY & RECOMMENDATIONS', heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ children: [ new TextRun({ text: 'Summary: ', bold: true }), new TextRun(form.summary || '') ] }),
            new Paragraph({ children: [ new TextRun({ text: 'Recommendations: ', bold: true }), new TextRun((form as any).recommendations || '') ] }),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${storageKey}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      alert('DOCX export not available. Please add the package: npm i docx');
    }
  };

  // -----------------------------
  // Lightweight self-tests (do not change existing tests; added for safety)
  // -----------------------------
  useEffect(() => {
    try {
      const k = computeStorageKey('Sea Wolf', '2025-09-16');
      console.assert(k.endsWith('160925'), 'storageKey DDMMYY failed');

      const sample: Photo[] = Array.from({ length: 10 }, (_, i) => ({ id: String(i), src: 'x', caption: String(i) }));
      const p = paginatePhotos(sample);
      console.assert(p.firstTwo.length === 2, 'firstTwo count');
      console.assert(p.groups.length === 2 && p.groups[0].length === 4 && p.groups[1].length === 4, 'groups of four');

      const list = ['Troubleshooting', 'Others'];
      const other = 'Leak test';
      const display = (() => {
        const li = [...list];
        const idx = li.indexOf('Others');
        if (idx !== -1 && other) li[idx] = `Others: ${other}`;
        return li.join(', ');
      })();
      console.assert(display.includes('Others: Leak test'), 'Others formatting');

      // New test: safeInnerText should not throw and should return '' when null
      console.assert(safeInnerText(null) === '', 'safeInnerText(null) should be empty string');

      // New test: paginatePhotos with <2 images
      const p2 = paginatePhotos([{ id: 'a', src: 'x', caption: 'a' }]);
      console.assert(p2.firstTwo.length === 1 && p2.groups.length === 0, 'paginatePhotos with 1 image');

      // New test: computeStorageKey fallback vessel
      const k2 = computeStorageKey('', '2025-01-05');
      console.assert(k2.startsWith('VESSEL') && k2.endsWith('050125'), 'computeStorageKey fallback');

      // New test: paginatePhotos with 0 images
      const p0 = paginatePhotos([] as Photo[]);
      console.assert(p0.firstTwo.length === 0 && p0.groups.length === 0, 'paginatePhotos with 0 images');

      // New test: recommendations present
      console.assert(typeof (form as any).recommendations === 'string', 'recommendations present');
    } catch {}
  }, []);

  // contentEditable ref + handlers (prevents null innerText errors)
  const findingsRef = useRef<HTMLDivElement | null>(null);
  const handleFindingsInput = () => {
    const text = safeInnerText(findingsRef.current);
    setForm((f) => (text === f.findings ? f : { ...f, findings: text }));
  };

  const summaryRef = useRef<HTMLDivElement | null>(null);
  const handleSummaryInput = () => {
    const text = safeInnerText(summaryRef.current);
    setForm((f) => (text === f.summary ? f : { ...f, summary: text }));
  };

  const recommendationsRef = useRef<HTMLDivElement | null>(null);
  const handleRecommendationsInput = () => {
    const text = safeInnerText(recommendationsRef.current);
    setForm((f) => (text === (f as any).recommendations ? f : { ...f, recommendations: text }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-50 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="font-semibold">Service Report – Editor</span>
          <span className="text-xs text-slate-500">Key: {storageKey}</span>

          {/* Saved reports dropdown + preview */}
          <div className="flex items-center gap-2">
            <select value={selectedSavedKey} onChange={(e) => setSelectedSavedKey(e.target.value)} className="border px-2 py-1 text-sm">
              {savedList.length === 0 && <option value="">No saved reports</option>}
              {savedList.map((it) => (
                <option key={it.key} value={it.key}>{it.label}</option>
              ))}
            </select>
            {savedList.find((x) => x.key === selectedSavedKey)?.preview && (
              <img src={savedList.find((x) => x.key === selectedSavedKey)!.preview} alt="preview" className="h-10 w-16 object-cover border" />
            )}
            <button onClick={() => loadFromStorage()} className="border px-3 py-1.5 text-sm hover:bg-slate-100">Load Selected</button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={saveToStorage} className="border px-3 py-1.5 text-sm hover:bg-slate-100">Save</button>
            <button onClick={() => loadFromStorage()} className="border px-3 py-1.5 text-sm hover:bg-slate-100">Load</button>
            <button onClick={saveAsDocx} className="border px-3 py-1.5 text-sm hover:bg-slate-100">Save as DOCX</button>
            <button onClick={printPDF} className="border px-3 py-1.5 text-sm hover:bg-slate-100">Download PDF</button>
          </div>
          <span className="text-xs text-emerald-600">{saveMsg}</span>
        </div>
      </div>

      {/* Screen-only form inputs */}
      <div className="no-print mx-auto mt-4 max-w-5xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">Company
            <select name="companyId" value={form.companyId} onChange={handleChange} className="mt-1 w-full border px-3 py-2">
              <option value="IMI">IMI</option>
              <option value="ITI">ITI</option>
            </select>
          </label>
          <label className="text-sm">Report Type
            <select name="reportType" value={form.reportType} onChange={handleChange} className="mt-1 w-full border px-3 py-2">
              <option>SERVICE REPORT</option>
              <option>JOB COMPLETION REPORT</option>
            </select>
          </label>
          <label className="text-sm">Logo URL (auto-fills per company; you can override)
            <input name="logoUrl" value={form.logoUrl} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Prepared By
            <input name="preparedBy" placeholder="???" value={form.preparedBy} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Customer Name
            <input name="customer" value={form.customer} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Vessel Name
            <input name="vessel" value={form.vessel} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Reference No.
            <input name="referenceNo" value={form.referenceNo} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Job Number
            <input name="jobNumber" value={form.jobNumber} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Job Date (Start)
            <input type="date" name="jobDateStart" value={form.jobDateStart} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Job Date (End)
            <input type="date" name="jobDateEnd" value={form.jobDateEnd} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm">Location
            <input name="location" value={form.location} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">Service Types (select all that apply)
            <div className="mt-1 flex flex-wrap gap-4">
              {['Troubleshooting','Inspection','Dry-Docking','Others'].map((opt) => (
                <label key={opt} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.serviceTypes.includes(opt)}
                    onChange={() => setForm((f) => ({
                      ...f,
                      serviceTypes: f.serviceTypes.includes(opt)
                        ? f.serviceTypes.filter((x) => x !== opt)
                        : [...f.serviceTypes, opt],
                    }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </label>
          {form.serviceTypes.includes('Others') && (
            <label className="text-sm md:col-span-2">Specify Others
              <input name="serviceTypeOther" value={form.serviceTypeOther} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
            </label>
          )}
          <label className="text-sm md:col-span-2">Equipment Make & Model
            <input name="equipmentMakeModel" value={form.equipmentMakeModel} onChange={handleChange} className="mt-1 w-full border px-3 py-2" />
          </label>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Photos (local upload; prints fine)</div>
            <label className="inline-flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-sm hover:bg-slate-100">
              <input type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" />
              <span>+ Add Photos</span>
            </label>
          </div>
          {!!photos.length && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {photos.map((p, i) => (
                <div key={p.id} className="border p-2">
                  <img
                    src={p.src}
                    alt={p.caption || `Photo ${i + 1}`}
                    className="mx-auto aspect-[4/3] h-auto w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <input
                    className="mt-2 w-full border px-2 py-1 text-sm"
                    placeholder="Caption"
                    value={p.caption}
                    onChange={(e) => setPhotos((prev) => prev.map((ph, idx) => (idx === i ? { ...ph, caption: e.target.value } : ph)))}
                  />
                  <div className="mt-2 flex justify-between text-xs text-slate-600">
                    <button onClick={() => movePhoto(i, -1)} className="border px-2 py-1 hover:bg-slate-100">↑</button>
                    <button onClick={() => movePhoto(i, 1)} className="border px-2 py-1 hover:bg-slate-100">↓</button>
                    <button onClick={() => removePhoto(i)} className="border px-2 py-1 hover:bg-slate-100">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Printable report */}
      <div className="mx-auto my-6 max-w-5xl border bg-white shadow-none print:shadow-none">
        {/* Fixed Header for print */}
        <header className="print fixed left-0 right-0 top-0 mx-auto max-w-5xl bg-white">
          <div className="px-6 pt-4">
            <div className="flex items-start justify-between gap-4">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Company Logo" className="h-12 w-auto" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="h-12 w-28 bg-slate-200 text-center text-[10px] leading-[48px] text-slate-500">LOGO</div>
              )}
              <div className="text-right text-[11px] leading-tight">
                <div className="font-bold">{company.name}</div>
                <div>{company.address1}</div>
                <div>{company.contact}</div>
                <div>{company.web}</div>
                <div>{company.reg}</div>
              </div>
            </div>
            <hr className="mt-3 border-slate-300" />
          </div>
        </header>

        {/* Content */}
        <main className="px-6 pb-24 pt-28">{/* leave space for fixed header/footer */}
          {/* Title */}
          <TitleBanner title={form.reportType} />

          {/* Job meta box */}
          <section className="mt-4 border border-slate-900/80">
            <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
              <Cell label="CUSTOMER NAME" value={form.customer} />
              <Cell label="VESSEL NAME" value={form.vessel} />
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
              <Cell label="REFERENCE NO." value={form.referenceNo} />
              <Cell label="JOB NUMBER" value={form.jobNumber} />
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
              <Cell label="JOB DATE" value={(form.jobDateStart || form.jobDateEnd) ? `${form.jobDateStart || ''}${form.jobDateEnd ? ` to ${form.jobDateEnd}` : ''}` : ''} />
              <Cell label="LOCATION" value={form.location} />
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
              <Cell label="SERVICE TYPE" value={serviceTypeDisplay} />
              <Cell label="EQUIPMENT MAKE & MODEL" value={form.equipmentMakeModel} />
            </div>
          </section>

          {/* Findings (with photos inside same border) */}
          <section className="mt-5 border border-slate-900/80">
            <NavyHeader title="FINDINGS" />
            <div
              ref={findingsRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Type findings here..."
              data-has-value={form.findings?.trim() ? 'true' : 'false'}
              suppressHydrationWarning
              className="mt-3 w-full px-3 py-2 text-sm no-print:mb-0 print:mb-0 whitespace-pre-wrap min-h-[120px]"
              onInput={handleFindingsInput}
              onBlur={handleFindingsInput}
            >
              {form.findings}
            </div>

            {photos.length > 0 && (
              <div className="mt-4">
                <NavyHeader title="PHOTOS" />
                {firstTwo.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 print:grid-cols-2 sm:grid-cols-2">
                    {firstTwo.map((p, i) => (
                      <figure key={p.id} className="border border-black/70 p-2">
                        <img src={p.src} alt={p.caption || `Photo ${i + 1}`} className="aspect-[4/3] h-auto w-full object-cover" />
                        <figcaption className="mt-2 text-[10px] leading-snug">{'Fig. ' + (i + 1) + (p.caption ? ' ' + p.caption : '')}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {groupsOfFour.length > 0 && firstTwo.length > 0 && <div className="page-break" />}
                {groupsOfFour.map((group, gi) => (
                  <div key={gi} className="mt-4">
                    <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
                      {group.map((p, i) => (
                        <figure key={p.id} className="border border-black/70 p-2">
                          <img src={p.src} alt={p.caption || `Photo ${2 + gi * 4 + i + 1}`} className="aspect-[4/3] h-auto w-full object-cover" />
                          <figcaption className="mt-2 text-[10px] leading-snug">{'Fig. ' + (firstTwo.length + 1 + gi * 4 + i) + (p.caption ? ' ' + p.caption : '')}</figcaption>
                        </figure>
                      ))}
                    </div>
                    {gi !== groupsOfFour.length - 1 && <div className="page-break" />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Summary & Recommendations (combined box) */}
          {/* Screen/editor version (always visible on screen for typing) */}
          <section className="no-print mt-5 border border-slate-900/80">
            <NavyHeader title="SUMMARY & RECOMMENDATIONS" />
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x">
              {/* Summary column */}
              <div className="p-3">
                <div className="text-[11px] font-semibold tracking-wide text-[#0B1C3D]">SUMMARY</div>
                <div
                  ref={summaryRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Type summary here..."
                  data-has-value={form.summary?.trim() ? 'true' : 'false'}
                  suppressHydrationWarning
                  className="mt-2 w-full px-3 py-2 text-sm whitespace-pre-wrap min-h-[120px]"
                  onInput={handleSummaryInput}
                  onBlur={handleSummaryInput}
                >
                  {form.summary}
                </div>
              </div>

              {/* Recommendations column */}
              <div className="p-3">
                <div className="text-[11px] font-semibold tracking-wide text-[#0B1C3D]">RECOMMENDATIONS</div>
                <div
                  ref={recommendationsRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Type recommendations here..."
                  data-has-value={(form as any).recommendations?.trim() ? 'true' : 'false'}
                  suppressHydrationWarning
                  className="mt-2 w-full px-3 py-2 text-sm whitespace-pre-wrap min-h-[120px]"
                  onInput={handleRecommendationsInput}
                  onBlur={handleRecommendationsInput}
                >
                  {(form as any).recommendations}
                </div>
              </div>
            </div>
          </section>

          {/* Print-only version (auto-hides single sub-heading/column if blank) */}
          <section className="only-print mt-5 border border-slate-900/80">
            <NavyHeader title="SUMMARY & RECOMMENDATIONS" />
            <div className={`grid grid-cols-1 ${ (form.summary?.trim() && (form as any).recommendations?.trim()) ? 'md:grid-cols-2 md:divide-x' : '' }`}>
              {/* Summary (print) */}
              {form.summary?.trim() && (
                <div className={(form as any).recommendations?.trim() ? 'p-3' : 'p-3 md:col-span-2'}>
                  <div className="text-[11px] font-semibold tracking-wide text-[#0B1C3D]">SUMMARY</div>
                  <div className="mt-2 w-full px-3 py-2 text-sm whitespace-pre-wrap min-h-[22px]">{form.summary}</div>
                </div>
              )}
              {/* Recommendations (print) */}
              {(form as any).recommendations?.trim() && (
                <div className={form.summary?.trim() ? 'p-3' : 'p-3 md:col-span-2'}>
                  <div className="text-[11px] font-semibold tracking-wide text-[#0B1C3D]">RECOMMENDATIONS</div>
                  <div className="mt-2 w-full px-3 py-2 text-sm whitespace-pre-wrap min-h-[22px]">{(form as any).recommendations}</div>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Fixed Footer for print */}
        <footer className="print fixed bottom-0 left-0 right-0 mx-auto max-w-5xl bg-white pb-3">
          <hr className="border-slate-300" />
          <div className="flex items-end justify-between px-6 pt-2 text-[10px] leading-tight">
            <div>
              Prepared By: <span className="inline-block min-w-[120px] border-b border-slate-600">{form.preparedBy || '???'}</span>
              &nbsp; Date: <span className="inline-block min-w-[100px] border-b border-slate-600">{todayStr}</span>
            </div>
            <div>Page <span className="page-x-of-y" /></div>
          </div>
          <div className="px-6 pt-1 text-[9px] italic text-slate-700">
            This Service Report is issued strictly subject to our Terms & Conditions 2025, available on our website. Confidential and for the Customer’s internal use only; no distribution or publication is permitted without our prior written consent.
          </div>
        </footer>
      </div>

      {/* PRINT CSS */}
      <style>{`
        /* Screen helpers */
        .no-print { }
        .only-print { display: none; }

        [contenteditable][data-placeholder]:not([data-has-value="true"]):before { content: attr(data-placeholder); color: #64748b; }

        /* Print rules */
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print { position: fixed; }
          .only-print { display: block; }
          main { padding-top: 110px !important; padding-bottom: 90px !important; }
          .page-x-of-y::after { content: counter(page) " / " counter(pages); }
          .break-inside-avoid { break-inside: avoid; }
          .page-break { break-after: page; }
        }
      `}</style>
    </div>
  );
}

function TitleBanner({ title }: { title: string }) {
  return (
    <div className="mt-2 border-2 border-[#0B1C3D] bg-[#0B1C3D] px-4 py-2 text-center text-white">
      <div className="text-xl md:text-2xl font-bold tracking-wide">{title}</div>
    </div>
  );
}

function NavyHeader({ title }: { title: string }) {
  return (
    <div className="border border-[#0B1C3D] bg-[#0B1C3D] px-3 py-1 text-white">
      <div className="text-[12px] font-semibold tracking-wide">{title}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-stretch">
      <div className="flex-1 p-3">
        <div className="text-[10px] font-bold tracking-wide text-[#0B1C3D]">{label}</div>
        <div className="mt-1 min-h-[22px] border border-slate-900/80 px-2 py-1 text-[12px]">
          {value || ''}
        </div>
      </div>
    </div>
  );
}
