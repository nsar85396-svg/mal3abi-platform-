import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, Search, ShieldCheck, Users, X, Menu, Zap, ChevronDown } from 'lucide-react'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const db = url && key ? createClient(url, key) : null
type Venue = { id: string; name: string; type: 'خماسي' | 'سداسي'; price: number }
const demoVenues: Venue[] = Array.from({ length: 20 }, (_, i) => ({
  id: '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
  name: 'ملعب ملعبي ' + String(i + 1).padStart(2, '0'),
  type: i < 10 ? 'خماسي' : 'سداسي',
  price: i < 10 ? 80 : 100
}))
const slots = Array.from({ length: 12 }, (_, i) => String((15 + i) % 24).padStart(2, '0') + ':00')
const photos = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1000&q=82',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1000&q=82',
  'https://images.unsplash.com/photo-1518604666860-9ed391f76460?auto=format&fit=crop&w=1000&q=82',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1000&q=82'
]
const keyDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export default function App() {
  const [venues, setVenues] = useState<Venue[]>(demoVenues)
  const [kind, setKind] = useState('الكل')
  const [query, setQuery] = useState('')
  const [day, setDay] = useState(keyDate(new Date()))
  const [time, setTime] = useState('18:00')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!db) return
    db.from('venues').select('id,name,venue_type,hourly_price').eq('is_active', true).order('name')
      .then(({ data, error }) => {
        if (!error && data) setVenues(data.map(row => ({ id: row.id, name: row.name, type: row.venue_type, price: Number(row.hourly_price) })))
      })
  }, [])

  const days = useMemo(() => {
    const base = new Date(keyDate(new Date()) + 'T12:00:00Z')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setUTCDate(d.getUTCDate() + i); return d
    })
  }, [])
  const list = venues.filter(v => (kind === 'الكل' || v.type === kind) && v.name.includes(query.trim()))

  async function book() {
    if (!venue || name.trim().length < 2 || phone.trim().length < 7) { setMessage('أدخل الاسم ورقم الهاتف بشكل صحيح.'); return }
    if (!db) { setMessage('هذه معاينة فقط. اربط قاعدة بيانات Supabase لتفعيل الحجز الحقيقي.'); return }
    setLoading(true); setMessage('')
    try {
      const start = new Date(day + 'T' + time + ':00+02:00')
      const end = new Date(start.getTime() + 3600000)
      const { data, error } = await db.rpc('create_public_booking', {
        p_venue_id: venue.id, p_customer_name: name.trim(), p_customer_phone: phone.trim(),
        p_slot_start: start.toISOString(), p_slot_end: end.toISOString()
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      setReceipt(row.booking_code); setVenue(null)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذر إنشاء الحجز') }
    finally { setLoading(false) }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="ملعبي - الرئيسية"><span className="brand-mark">⚽</span><span className="brand-name">ملعبي<small>MAL3ABI</small></span></a>
      <nav className={menuOpen ? 'nav-open' : ''}>
        <a href="#home" onClick={() => setMenuOpen(false)}>الرئيسية</a>
        <a href="#venues" onClick={() => setMenuOpen(false)}>الملاعب</a>
        <a href="#how" onClick={() => setMenuOpen(false)}>كيف تحجز؟</a>
        <a href="#faq" onClick={() => setMenuOpen(false)}>الأسئلة الشائعة</a>
      </nav>
      <a className="header-cta" href="#venues">احجز ملعبك <ArrowLeft size={16}/></a>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="القائمة">{menuOpen ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-image" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="eyebrow"><i className="pulse-dot"/> ملعبك القادم على بُعد خطوات</span>
          <h1>اللعب أحلى<br/>لما يكون <em>ملعبي.</em></h1>
          <p>اجمع فريقك، اختر الملعب والوقت المناسب، وخلي الباقي علينا. بداية لعبتك الجديدة تبدأ من هنا.</p>
          <div className="hero-actions"><a className="primary-cta" href="#venues">اكتشف الملاعب <ArrowLeft size={18}/></a><a className="text-cta" href="#how">كيف تحجز؟ <span>⌄</span></a></div>
          <div className="hero-proof"><div className="proof-icon"><ShieldCheck size={18}/></div><span><b>حجز بخطوات واضحة</b><small>تفاصيل السعر والموعد قبل التأكيد</small></span></div>
        </div>
        <div className="hero-side-note"><span>01</span><i/> وقتك للعب، مو للبحث</div>
        <div className="hero-bottom"><span>كرة قدم · ملاعب خماسية وسداسية</span><span>طرابلس، ليبيا <MapPin size={13}/></span></div>
      </section>

      <section className="quick-facts">
        <div><span className="fact-icon"><Zap/></span><span><b>حجز سريع</b><small>اختيار الملعب والموعد بسهولة</small></span></div>
        <div><span className="fact-icon"><Clock3/></span><span><b>مواعيد مسائية</b><small>من 3 عصرًا حتى 2 ليلًا</small></span></div>
        <div><span className="fact-icon"><Users/></span><span><b>اختر فريقك</b><small>ملاعب خماسية وسداسية</small></span></div>
        <div className="facts-note">منصة تجريبية · البيانات والأسعار المعروضة توضيحية</div>
      </section>

      <section className="venues-section section-wrap" id="venues">
        <div className="section-topline"><span className="eyebrow">اختار الملعب، والباقي سهل</span><span className="section-index">01 / الملاعب</span></div>
        <div className="section-heading"><div><h2>وين <em>مباراتكم؟</em></h2><p>تصفّح الخيارات واختار المساحة المناسبة لفريقك.</p></div><span className="venue-count"><b>{venues.length}</b> ملعب متاح للعرض</span></div>
        <div className="filter-bar">
          <label className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث باسم الملعب..." /></label>
          <div className="filter-buttons">{['الكل', 'خماسي', 'سداسي'].map(x => <button key={x} className={kind === x ? 'selected' : ''} onClick={() => setKind(x)}>{x}</button>)}</div>
        </div>
        <div className="venue-grid">{list.map((v, i) => <article className="venue-card" key={v.id}>
          <div className="venue-photo" style={{ backgroundImage: 'url("' + photos[i % photos.length] + '")' }}>
            <span className="venue-type">{v.type}</span><span className="photo-number">M / {String(i + 1).padStart(2, '0')}</span>
            <span className="photo-caption"><i/> عشب صناعي</span>
          </div>
          <div className="venue-info"><div><h3>{v.name}</h3><p><MapPin size={13}/> الموقع يحدده الملعب عند تفعيل البيانات</p></div><div className="price"><b>{v.price}</b><small>د.ل <i>/ ساعة</i></small></div></div>
          <button className="book-button" onClick={() => { setVenue(v); setMessage('') }}>شوف المواعيد واحجز <ArrowLeft size={16}/></button>
        </article>)}</div>
        {list.length === 0 && <div className="empty-state">ما لقينا ملاعب تطابق بحثك. جرّب كلمة ثانية.</div>}
      </section>

      <section className="how-section" id="how">
        <div className="section-wrap how-inner">
          <div className="how-intro"><span className="eyebrow">بثلاث خطوات بس</span><h2>من أول رسالة<br/>إلى <em>صافرة البداية.</em></h2><p>خلّينا الحجز أسهل. لا لف ولا تعقيد، اختار ملعبك وحدد وقتك.</p><a href="#venues" className="outline-cta">ابدأ الحجز <ArrowLeft size={16}/></a></div>
          <div className="steps">
            <article className="step-card"><span className="step-no">01</span><span className="step-icon"><Search/></span><h3>اختار ملعبك</h3><p>شوف الملاعب المتاحة وحدد خماسي أو سداسي.</p></article>
            <article className="step-card"><span className="step-no">02</span><span className="step-icon"><CalendarDays/></span><h3>حدد الموعد</h3><p>اختار اليوم والساعة اللي تناسب فريقك.</p></article>
            <article className="step-card"><span className="step-no">03</span><span className="step-icon"><Check/></span><h3>أكد طلبك</h3><p>اكتب بياناتك واحتفظ برقم طلب الحجز.</p></article>
          </div>
        </div>
      </section>

      <section className="closing-cta section-wrap">
        <div><span className="eyebrow">جاهزين للمباراة؟</span><h2>فريقك ينقصه <em>ملعب.</em></h2><p>لا تخلي الحماس ينتظر. اختار موعدكم وابدأوا اللعب.</p></div>
        <a className="primary-cta" href="#venues">احجز ملعبك الآن <ArrowLeft size={18}/></a>
        <span className="cta-ball">⚽</span>
      </section>

      <section className="faq-section section-wrap" id="faq">
        <div><span className="eyebrow">عندك سؤال؟</span><h2>خلّينا <em>نوضّحها.</em></h2></div>
        <div className="faq-list">
          <details><summary>هل الحجز الإلكتروني مفعّل؟ <ChevronDown size={18}/></summary><p>الموقع حاليًا نسخة تجريبية. تأكيد الحجز الحقيقي يحتاج ربط قاعدة بيانات Supabase وإعدادها.</p></details>
          <details><summary>هل الأسعار والملاعب حقيقية؟ <ChevronDown size={18}/></summary><p>الأسماء والأسعار والصور المعروضة أمثلة توضيحية إلى أن تُضاف بيانات الملاعب الفعلية.</p></details>
          <details><summary>كيف يتم الدفع؟ <ChevronDown size={18}/></summary><p>في النسخة الحالية لا يوجد دفع إلكتروني. تفاصيل الدفع النهائية تُحدد مع إدارة الملعب.</p></details>
        </div>
      </section>
    </main>

    <footer className="footer">
      <a className="brand" href="#home"><span className="brand-mark">⚽</span><span className="brand-name">ملعبي<small>MAL3ABI</small></span></a>
      <p>اللعبة أحلى لما تكون محجوزة.</p>
      <div className="footer-links"><a href="#venues">الملاعب</a><a href="#how">طريقة الحجز</a><a href="#faq">الأسئلة</a></div>
      <span className="copyright">© 2026 ملعبي</span>
    </footer>

    {venue && <div className="modal-backdrop" onClick={() => setVenue(null)}><section className="booking-modal" onClick={e => e.stopPropagation()}>
      <button className="close-button" onClick={() => setVenue(null)} aria-label="إغلاق"><X/></button>
      <span className="eyebrow">خطوة واحدة تفصلك عن اللعب</span><h2>احجز <em>{venue.name}</em></h2><p className="modal-sub">{venue.type} · {venue.price} د.ل للساعة · الدفع في الملعب</p>
      <label className="field-label"><CalendarDays size={16}/> اختر اليوم</label>
      <div className="date-options">{days.map(d => <button key={keyDate(d)} className={day === keyDate(d) ? 'active' : ''} onClick={() => setDay(keyDate(d))}>{new Intl.DateTimeFormat('ar-LY', { timeZone: 'Africa/Tripoli', weekday: 'short', day: 'numeric', month: 'short' }).format(d)}</button>)}</div>
      <label className="field-label"><Clock3 size={16}/> وقت البداية</label><div className="time-options">{slots.map(t => <button key={t} className={time === t ? 'active' : ''} onClick={() => setTime(t)}>{t}</button>)}</div>
      <div className="form-grid"><label>الاسم<input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك الكامل"/></label><label>رقم الهاتف<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="09xxxxxxxx"/></label></div>
      {message && <div className="notice">{message}</div>}
      <button className="confirm-button" disabled={loading} onClick={book}>{loading ? 'جارٍ تأكيد الحجز...' : 'تأكيد طلب الحجز'} <Check size={17}/></button><small className="secure-note">لا يتم تحصيل أي مبلغ إلكترونيًا. الدفع في الملعب.</small>
    </section></div>}
    {receipt && <div className="modal-backdrop" onClick={() => setReceipt('')}><section className="success-modal" onClick={e => e.stopPropagation()}><span className="success-icon"><Check/></span><h2>تم استلام طلبك</h2><p>رقم الحجز: <b>{receipt}</b></p><small>احتفظ برقم الحجز. تفعيل إشعار واتساب يأتي في مرحلة لاحقة.</small><button className="confirm-button" onClick={() => setReceipt('')}>حسنًا</button></section></div>}
  </div>
}
