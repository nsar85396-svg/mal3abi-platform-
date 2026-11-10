import { useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, Search, ShieldCheck, Trophy, Users, X } from 'lucide-react'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const db = url && key ? createClient(url, key) : null
type Venue = { id: string; name: string; type: 'خماسي' | 'سداسي'; price: number }
const venues: Venue[] = Array.from({length:20}, (_,i) => ({
  id: '00000000-0000-4000-8000-' + String(i+1).padStart(12,'0'),
  name: 'ملعب ملعبي ' + String(i+1).padStart(2,'0'),
  type: i < 10 ? 'خماسي' : 'سداسي',
  price: i < 10 ? 80 : 100
}))
const slots = Array.from({length:11}, (_,i) => String((15+i)%24).padStart(2,'0') + ':00')
const keyDate = (d:Date) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')

export default function App() {
  const [kind,setKind] = useState('الكل')
  const [query,setQuery] = useState('')
  const [day,setDay] = useState(keyDate(new Date()))
  const [time,setTime] = useState('18:00')
  const [venue,setVenue] = useState<Venue|null>(null)
  const [name,setName] = useState('')
  const [phone,setPhone] = useState('')
  const [message,setMessage] = useState('')
  const [loading,setLoading] = useState(false)
  const [receipt,setReceipt] = useState('')
  const days = useMemo(() => Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d}),[])
  const list = venues.filter(v => (kind==='الكل'||v.type===kind) && v.name.includes(query.trim()))

  async function book() {
    if (!venue || name.trim().length<2 || phone.trim().length<7) { setMessage('أدخل الاسم ورقم الهاتف بشكل صحيح.'); return }
    if (!db) { setMessage('هذه معاينة فقط. اربط قاعدة بيانات Supabase لتفعيل الحجز الحقيقي.'); return }
    setLoading(true); setMessage('')
    try {
      const start = new Date(day+'T'+time+':00')
      const end = new Date(start.getTime()+3600000)
      const {data,error} = await db.rpc('create_public_booking',{
        p_venue_id:venue.id,p_customer_name:name.trim(),p_customer_phone:phone.trim(),
        p_slot_start:start.toISOString(),p_slot_end:end.toISOString()
      })
      if(error) throw error
      const row = Array.isArray(data)?data[0]:data
      setReceipt(row.booking_code); setVenue(null)
    } catch(e) { setMessage(e instanceof Error?e.message:'تعذر إنشاء الحجز') }
    finally { setLoading(false) }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Trophy size={21}/></span><span>ملعبي<small>MAL3ABI</small></span></a>
      <nav><a className="nav-active" href="#venues">الملاعب</a><a href="#how">كيف تحجز؟</a></nav>
      <a className="admin-link" href="#admin">الإدارة <ArrowLeft size={15}/></a>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow"><i className="live-dot"/> ملاعبك، أقرب مما تتوقع</span><h1>اللعب يبدأ<br/><em>من هنا.</em></h1><p>اختر ملعبك وموعدك، واحجز لعبتك القادمة بخطوات بسيطة.</p><a className="hero-cta" href="#venues">استكشف الملاعب <ArrowLeft size={17}/></a></div>
        <div className="hero-art"><div className="stadium-glow"/><div className="pitch"><i className="pitch-line"/><i className="pitch-circle"/><i className="pitch-box left"/><i className="pitch-box right"/></div><div className="hero-ball">⚽</div><div className="hero-tag"><strong>20</strong><span>ملعبًا للاختيار</span></div></div>
        <div className="hero-bottom"><span>01 / احجز بسهولة</span><span>02 / اختر الوقت</span><span>03 / استمتع باللعب</span></div>
      </section>
      <section className="trust-row" id="how">
        <div><ShieldCheck/><span><b>حجز واضح</b><small>تفاصيل الموعد قبل التأكيد</small></span></div>
        <div><Clock3/><span><b>مواعيد مرنة</b><small>يوميًا من 3 عصرًا إلى 2 ليلًا</small></span></div>
        <div><Users/><span><b>خماسي وسداسي</b><small>اختر نوع لعبتك</small></span></div>
      </section>
      <section className="venues-section" id="venues">
        <div className="section-heading"><div><span className="eyebrow">اعثر على ملعبك</span><h2>اختر ملعب <em>المباراة</em></h2><p>تصفّح الملاعب وحدد النوع المناسب لفريقك.</p></div><div className="count-pill"><b>20</b> ملعبًا</div></div>
        <div className="filters"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن ملعب..."/></div><div className="filter-buttons">{['الكل','خماسي','سداسي'].map(x=><button key={x} className={kind===x?'selected':''} onClick={()=>setKind(x)}>{x}</button>)}</div></div>
        <div className="venue-grid">{list.map((v,i)=><article className="venue-card" key={v.id}><div className="venue-visual"><span className="venue-type">{v.type}</span><span className="venue-number">#{String(i+1).padStart(2,'0')}</span><div className="mini-pitch"><i/><b/></div><span className="surface-label">عشب صناعي</span></div><div className="venue-info"><div><h3>{v.name}</h3><p><MapPin size={13}/> الموقع يحدد لاحقًا</p></div><div className="price"><b>{v.price}</b><small>د.ل / ساعة</small></div></div><button className="book-button" onClick={()=>{setVenue(v);setMessage('')}}>احجز هذا الملعب <ArrowLeft size={16}/></button></article>)}</div>
        {list.length===0&&<div className="empty-state">لا توجد ملاعب تطابق بحثك.</div>}
      </section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><Trophy size={18}/></span><span>ملعبي<small>MAL3ABI</small></span></a><p>اللعبة أحلى لما تكون محجوزة.</p><span>© ملعبي 2026</span></footer>
    {venue&&<div className="modal-backdrop" onClick={()=>setVenue(null)}><section className="booking-modal" onClick={e=>e.stopPropagation()}><button className="close-button" onClick={()=>setVenue(null)}><X/></button><span className="eyebrow">خطوة واحدة تفصلك عن اللعب</span><h2>احجز <em>{venue.name}</em></h2><p className="modal-sub">{venue.type} · {venue.price} د.ل للساعة · الدفع في الملعب</p><label className="field-label"><CalendarDays size={16}/> اختر اليوم</label><div className="date-options">{days.map(d=><button key={keyDate(d)} className={day===keyDate(d)?'active':''} onClick={()=>setDay(keyDate(d))}>{new Intl.DateTimeFormat('ar-LY',{weekday:'short',day:'numeric',month:'short'}).format(d)}</button>)}</div><label className="field-label"><Clock3 size={16}/> وقت البداية</label><div className="time-options">{slots.map(t=><button key={t} className={time===t?'active':''} onClick={()=>setTime(t)}>{t}</button>)}</div><div className="form-grid"><label>الاسم<input value={name} onChange={e=>setName(e.target.value)} placeholder="اسمك الكامل"/></label><label>رقم الهاتف<input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder="09xxxxxxxx"/></label></div>{message&&<div className="notice">{message}</div>}<button className="confirm-button" disabled={loading} onClick={book}>{loading?'جارٍ تأكيد الحجز...':'تأكيد طلب الحجز'} <Check size={17}/></button><small className="secure-note">لا يتم تحصيل أي مبلغ إلكترونيًا. الدفع في الملعب.</small></section></div>}
    {receipt&&<div className="modal-backdrop" onClick={()=>setReceipt('')}><section className="success-modal" onClick={e=>e.stopPropagation()}><span className="success-icon"><Check/></span><h2>تم استلام طلبك</h2><p>رقم الحجز: <b>{receipt}</b></p><small>احتفظ برقم الحجز. تفعيل إشعار واتساب يأتي في مرحلة لاحقة.</small><button className="confirm-button" onClick={()=>setReceipt('')}>حسنًا</button></section></div>}
  </div>
}