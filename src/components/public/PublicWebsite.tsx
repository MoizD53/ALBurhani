import React, { useState } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Phone, 
  Clock, 
  ShieldCheck, 
  Award, 
  Truck, 
  CheckCircle2, 
  ArrowRight, 
  MessageCircle, 
  ChevronRight,
  Store,
  Menu,
  X,
  Lock
} from 'lucide-react';
import { UserProfile } from '../../types';

interface PublicWebsiteProps {
  onNavigateToAdmin: () => void;
  currentUser?: UserProfile | null;
}

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  onNavigateToAdmin,
  currentUser,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryCategory, setInquiryCategory] = useState('Dry Fruits');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName.trim() || !inquiryPhone.trim()) return;
    setInquirySubmitted(true);
    // WhatsApp pre-fill link for immediate inquiry
    const text = encodeURIComponent(
      `Hello AL-BURHANI, my name is ${inquiryName.trim()} (${inquiryPhone.trim()}). I am inquiring about ${inquiryCategory}: ${inquiryNotes.trim() || 'Please share product catalog and pricing.'}`
    );
    window.open(`https://wa.me/919876543210?text=${text}`, '_blank');
  };

  const productCategories = [
    {
      title: 'Premium Dry Fruits',
      tag: 'Handpicked Grade-A',
      desc: 'Selected California Almonds, Jumbo Cashews, Afghan Anjeer, Green Pistachios, and Seedless Raisins.',
      items: ['California Badam (Almonds)', 'Jumbo Kaju (Cashews)', 'Afghani Anjeer (Figs)', 'Roasted & Salted Pista', 'Premium Kishmish'],
      badge: 'Available by Weight & Packets',
    },
    {
      title: 'Traditional Sweets & Murabba',
      tag: 'Fresh Daily Preparation',
      desc: 'Authentic regional delights prepared with pure ghee, mawa, and traditional recipes perfected over years.',
      items: ['Aachar Chundo (Murabbo)', 'Green Marcha Aachar', 'Pure Mawa Peda', 'Kaju Katli Special', 'Dry Fruit Chikki & Halwa'],
      badge: 'Hygienic Counter Packing',
    },
    {
      title: 'Roasted Snacks & Namkeen',
      tag: 'Crisp & Wholesome',
      desc: 'Delicious tea-time savories, farali specialties, and crunchy roasted nuts seasoned with authentic spices.',
      items: ['Special Farali Chiwda', 'Roasted Peri-Peri Makhana', 'Salted Cashews & Peanuts', 'Crispy Banana Wafers', 'Diet Mixture'],
      badge: 'Fresh Batch Guarantee',
    },
    {
      title: 'Celebration & Gift Hampers',
      tag: 'Customized & Festive',
      desc: 'Exquisite wooden and velvet gift boxes for weddings, corporate gifting, Diwali, Eid, and family celebrations.',
      items: ['Executive Dry Fruit Boxes', 'Wedding Invitation Packs', 'Customized Festive Trays', 'Bulk Corporate Supply'],
      badge: 'Custom Branding Available',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCFAF6] text-[#1C1917] flex flex-col font-sans selection:bg-[#C99A18]/20 selection:text-[#7A5B0B]">
      
      {/* 1. Top Announcement Foundation Ribbon */}
      <div className="bg-[#1C1917] text-amber-100 text-[11px] sm:text-xs py-2 px-4 border-b border-[#C99A18]/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="inline-flex items-center gap-1 bg-[#C99A18]/20 text-[#E5B537] px-2 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase">
              <Sparkles className="w-3 h-3" /> Foundation Preview
            </span>
            <span className="hidden sm:inline text-stone-300 font-medium truncate">
              AL-BURHANI Sweets & Dry Items Franchise · Dahod (Godi Road & MG Road)
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E5B537] hover:text-white transition-colors cursor-pointer"
              >
                <span>Logged in as <strong>{currentUser.name}</strong></span>
                <span className="underline ml-1">Go to POS Dashboard →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200/90 hover:text-white transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>Staff & Admin Portal →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8DEC8] shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FAF5E6] to-[#F1E4C3] border border-[#C99A18]/40 flex items-center justify-center shadow-xs">
              <img 
                src="./logo.png" 
                alt="AL-BURHANI Logo" 
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  // Fallback if image fails
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-black text-lg sm:text-xl tracking-tight text-stone-900 leading-none">
                  AL-BURHANI
                </span>
                <span className="text-[10px] uppercase font-bold text-[#A67D0C] bg-[#FAF8F5] border border-[#C99A18]/40 px-1.5 py-0.2 rounded leading-none">
                  Dahod
                </span>
              </div>
              <p className="text-[10px] text-stone-500 font-medium tracking-wide">
                Sweets, Dry Fruits & Premium Dry Items
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-stone-700">
            <a href="#home" className="hover:text-[#A67D0C] transition-colors">Home</a>
            <a href="#products" className="hover:text-[#A67D0C] transition-colors">Products</a>
            <a href="#about" className="hover:text-[#A67D0C] transition-colors">About Us</a>
            <a href="#stores" className="hover:text-[#A67D0C] transition-colors">Our Stores</a>
            <a href="#contact" className="hover:text-[#A67D0C] transition-colors">Contact</a>
          </nav>

          {/* Action CTA */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FAF8F5] hover:bg-[#F3EAD3] text-[#8C6D15] border border-[#C99A18]/50 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-[#C99A18]" />
              <span>{currentUser ? 'POS Dashboard' : 'Admin / POS Login'}</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E8DEC8] bg-[#FAF8F5] px-4 py-4 space-y-3">
            <nav className="flex flex-col gap-2.5 text-sm font-semibold text-stone-700">
              <a 
                href="#home" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 rounded-lg hover:bg-white"
              >
                Home
              </a>
              <a 
                href="#products" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 rounded-lg hover:bg-white"
              >
                Products
              </a>
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 rounded-lg hover:bg-white"
              >
                About Us
              </a>
              <a 
                href="#stores" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 rounded-lg hover:bg-white"
              >
                Our Stores
              </a>
              <a 
                href="#contact" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 px-2 rounded-lg hover:bg-white"
              >
                Contact
              </a>
            </nav>

            <div className="pt-2 border-t border-[#E8DEC8]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToAdmin();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{currentUser ? 'Go to POS Dashboard' : 'Admin & Staff POS Portal'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. Hero Section */}
      <section id="home" className="relative py-12 sm:py-20 px-4 sm:px-6 overflow-hidden bg-gradient-to-b from-[#FAF6ED] to-[#FCFAF6] border-b border-[#E8DEC8]">
        {/* Subtle decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#E5B537]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#A67D0C]/10 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0D7] border border-[#C99A18]/40 text-[#7A5B0B] text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pure Taste · Handpicked Freshness · Trusted Heritage</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-black text-stone-900 tracking-tight leading-tight">
            Premium Dry Fruits & Authentic Handcrafted Sweets
          </h1>

          <p className="text-sm sm:text-base text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Welcome to the digital home of <strong>AL-BURHANI Franchise</strong>. Dahod's premier family-trusted destination for crisp dry fruits, authentic regional murabba, rich mawa sweets, and celebratory gift hampers.
          </p>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#products"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#B8860B] hover:bg-[#996F09] text-white shadow-md transition-all active:scale-95"
            >
              <span>Explore Products</span>
              <ChevronRight className="w-4 h-4" />
            </a>

            <a
              href="#stores"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-[#FAF8F5] text-stone-800 border border-[#E8DEC8] shadow-2xs transition-all active:scale-95"
            >
              <MapPin className="w-4 h-4 text-[#C99A18]" />
              <span>Visit Our Stores</span>
            </a>

            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#FAF8F5] hover:bg-[#F3EAD3] text-[#8C6D15] border border-[#C99A18]/40 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Store className="w-4 h-4 text-[#C99A18]" />
              <span>{currentUser ? 'Open POS Dashboard' : 'Staff / Admin Portal'}</span>
            </button>
          </div>

          {/* Key Trust Highlights */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3 rounded-xl bg-white/80 border border-[#E8DEC8] shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-[#C99A18] mb-1" />
              <div className="font-bold text-xs text-stone-900">100% Quality</div>
              <div className="text-[10px] text-stone-500">Rigorous grading & purity</div>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-[#E8DEC8] shadow-2xs">
              <Award className="w-5 h-5 text-[#C99A18] mb-1" />
              <div className="font-bold text-xs text-stone-900">Trusted Taste</div>
              <div className="text-[10px] text-stone-500">Generations of heritage</div>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-[#E8DEC8] shadow-2xs">
              <Store className="w-5 h-5 text-[#C99A18] mb-1" />
              <div className="font-bold text-xs text-stone-900">2 Dahod Stores</div>
              <div className="text-[10px] text-stone-500">Godi Road & MG Road</div>
            </div>

            <div className="p-3 rounded-xl bg-white/80 border border-[#E8DEC8] shadow-2xs">
              <Truck className="w-5 h-5 text-[#C99A18] mb-1" />
              <div className="font-bold text-xs text-stone-900">Bulk & Counter</div>
              <div className="text-[10px] text-stone-500">Retail & wedding supply</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Products Showcase Section */}
      <section id="products" className="py-14 sm:py-20 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
          <span className="text-xs uppercase font-bold tracking-wider text-[#A67D0C]">
            Signature Selections
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-black text-stone-900">
            Handcrafted Delights & Daily Essentials
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Available daily across retail counters in customized sizes, sealed packs, and hygienic gift trays.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {productCategories.map((cat, idx) => (
            <div 
              key={idx}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E8DEC8] hover:border-[#C99A18] transition-all hover:shadow-lg space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D15] bg-[#FAF8F5] border border-[#C99A18]/30 px-2 py-0.5 rounded-full">
                    {cat.tag}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {cat.badge}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                  {cat.title}
                </h3>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {cat.desc}
                </p>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1.5">
                    Popular Varieties:
                  </span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-stone-800">
                    {cat.items.map((it, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium truncate">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F0EBE0] flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-500">
                  Available in-store today
                </span>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#A67D0C] hover:text-[#8C6D15]"
                >
                  <span>Inquire Stock</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. About Heritage Section */}
      <section id="about" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#FAF6ED] border-y border-[#E8DEC8]">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <span className="text-xs uppercase font-bold tracking-wider text-[#A67D0C]">
            Our Commitment & Heritage
          </span>

          <h2 className="text-2xl sm:text-4xl font-serif font-black text-stone-900">
            Dedicated to Authenticity, Freshness & Transparent Service
          </h2>

          <div className="text-xs sm:text-sm text-stone-700 space-y-3 leading-relaxed max-w-2xl mx-auto text-left sm:text-center">
            <p>
              At <strong>AL-BURHANI</strong>, we believe that whether it is a festival, a wedding, or a morning snack of California almonds, every family deserves ingredients of uncompromised purity.
            </p>
            <p>
              Operating directly from Dahod's historic Godi Road commercial corridor, our counters are equipped with high-precision digital scales, certified hygiene packaging, and clear computerized billing.
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-stone-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A18]" />
              <span>Certified Hygiene Standards</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A18]" />
              <span>Computerized Precision Weighing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A18]" />
              <span>Bulk Gifting Specialists</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Store Locations & Hours */}
      <section id="stores" className="py-14 sm:py-20 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
          <span className="text-xs uppercase font-bold tracking-wider text-[#A67D0C]">
            Retail Locations
          </span>
          <h2 className="text-2xl sm:text-4xl font-serif font-black text-stone-900">
            Visit Our Stores in Dahod
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Conveniently situated in central commercial hubs with convenient parking and rapid counter service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Godi Road Flagship */}
          <div className="p-6 rounded-2xl bg-white border border-[#E8DEC8] space-y-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Flagship Store & Main Inventory
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900 mt-1.5">
                  Godi Road Store
                </h3>
              </div>
              <Store className="w-6 h-6 text-[#C99A18]" />
            </div>

            <div className="space-y-2 text-xs text-stone-700">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#C99A18] shrink-0 mt-0.5" />
                <span>Godi Road, Near Clock Tower, Dahod, Gujarat – 389151</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#C99A18] shrink-0" />
                <a href="tel:+919876543210" className="font-mono font-bold text-stone-900 hover:underline">
                  +91 98765 43210
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C99A18] shrink-0" />
                <span>9:00 AM – 10:00 PM (Monday to Sunday)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0EBE0] flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Retail & Bulk Order Hub</span>
              <a 
                href="https://wa.me/919876543210?text=Hello%20AL-BURHANI%20Godi%20Road,%20I%20would%20like%20to%20place%20an%20order" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Store</span>
              </a>
            </div>
          </div>

          {/* MG Road Branch */}
          <div className="p-6 rounded-2xl bg-white border border-[#E8DEC8] space-y-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Retail Counter Branch
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900 mt-1.5">
                  MG Road Branch
                </h3>
              </div>
              <Store className="w-6 h-6 text-[#C99A18]" />
            </div>

            <div className="space-y-2 text-xs text-stone-700">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#C99A18] shrink-0 mt-0.5" />
                <span>MG Road Market Corridor, Dahod, Gujarat – 389151</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#C99A18] shrink-0" />
                <a href="tel:+919876543210" className="font-mono font-bold text-stone-900 hover:underline">
                  +91 98765 43210
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C99A18] shrink-0" />
                <span>9:30 AM – 9:30 PM (Daily)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0EBE0] flex items-center justify-between">
              <span className="text-[11px] text-stone-500">Fresh Sweets & Quick Counter Sales</span>
              <a 
                href="https://wa.me/919876543210?text=Hello%20AL-BURHANI%20MG%20Road,%20I%20would%20like%20to%20place%20an%20order" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Store</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Contact & Bulk Order Inquiries */}
      <section id="contact" className="py-14 sm:py-20 px-4 sm:px-6 bg-[#FAF6ED] border-t border-[#E8DEC8]">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs uppercase font-bold tracking-wider text-[#A67D0C]">
              Direct Inquiries & Bulk Orders
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-black text-stone-900">
              Need Wedding Hampers or Wholesale Orders?
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              We cater to special family celebrations, festival corporate gifting, and bulk dry fruit supplies across Dahod and neighboring regions. Reach out directly for custom packaging.
            </p>

            <div className="space-y-2 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">Direct WhatsApp:</span>
                <a href="https://wa.me/919876543210" className="text-emerald-700 font-bold hover:underline">
                  +91 98765 43210
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-stone-600" />
                <span className="font-semibold">Phone Support:</span>
                <span className="font-mono text-stone-800">+91 98765 43210</span>
              </div>
            </div>
          </div>

          {/* Quick Inquiry Form */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
            <h3 className="font-serif font-bold text-base text-stone-900 mb-3">
              Quick Inquiry Form
            </h3>

            {inquirySubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2 text-center animate-fade-in">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-bold text-sm">Inquiry Forwarded!</p>
                <p className="text-[11px] text-emerald-700">
                  Thank you, {inquiryName}. Our store representative will connect with you shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setInquirySubmitted(false)}
                  className="mt-2 text-[10px] font-bold text-emerald-800 underline cursor-pointer"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Mobile / WhatsApp Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="e.g. 98250 12345"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Product Interest
                  </label>
                  <select
                    value={inquiryCategory}
                    onChange={(e) => setInquiryCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none font-medium"
                  >
                    <option value="Dry Fruits">Dry Fruits (Cashews, Almonds, Pistachios)</option>
                    <option value="Wedding Gift Hampers">Wedding & Corporate Gift Hampers</option>
                    <option value="Traditional Sweets">Traditional Sweets & Murabba</option>
                    <option value="Roasted Namkeen">Farali Chiwda & Namkeen</option>
                    <option value="Wholesale Inward Supply">Wholesale Counter Supply</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Requirements / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={inquiryNotes}
                    onChange={(e) => setInquiryNotes(e.target.value)}
                    placeholder="e.g. Need 50 boxes of gift hampers for family event next week"
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#B8860B] hover:bg-[#996F09] text-white shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send Inquiry via WhatsApp</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="mt-auto bg-[#1C1917] text-stone-400 text-xs py-8 px-4 sm:px-6 border-t border-[#C99A18]/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-serif font-bold text-white text-base">AL-BURHANI</span>
              <span className="text-[10px] text-[#C99A18] bg-[#C99A18]/20 px-2 py-0.2 rounded font-bold">Dahod</span>
            </div>
            <p className="text-[11px] text-stone-500">
              © {new Date().getFullYear()} AL-BURHANI Sweets & Dry Items Franchise. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-stone-400">
            <a href="#home" className="hover:text-amber-200 transition-colors">Home</a>
            <a href="#products" className="hover:text-amber-200 transition-colors">Products</a>
            <a href="#about" className="hover:text-amber-200 transition-colors">About</a>
            <a href="#stores" className="hover:text-amber-200 transition-colors">Store Locations</a>
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="hover:text-amber-300 font-bold text-amber-200/90 underline cursor-pointer"
            >
              Admin & Staff POS Login →
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
