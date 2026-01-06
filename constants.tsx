
export const TRIAL_DURATION_DAYS = 14;
export const TRIAL_MAX_GOALS = 1;

// --- DŮLEŽITÉ: ZDE VLOŽ SVÉ REÁLNÉ STRIPE ODKAZY ---
export const STRIPE_CONFIG = {
  // 1. Odkaz z 'Payment Links' v Stripe.
  // DŮLEŽITÉ: V nastavení tohoto odkazu ve Stripe nastavte "After payment" redirect na:
  // http://localhost:5173/?payment_success=true (pro lokální vývoj)
  // nebo https://tvoje-app.com/?payment_success=true (pro produkci)
  PAYMENT_LINK_URL: "https://buy.stripe.com/28E28raLm8GDakye5Oco000", 

  // 2. Odkaz z 'Customer Portal' v nastavení Stripe
  // Umožňuje uživatelům spravovat kartu, stahovat faktury a rušit předplatné.
  CUSTOMER_PORTAL_URL: "https://billing.stripe.com/p/login/28E28raLm8GDakye5Oco000" 
};

export const CATEGORIES = [
  { id: 'health', icon: 'fa-heart-pulse' },
  { id: 'finance', icon: 'fa-wallet' },
  { id: 'career', icon: 'fa-briefcase' },
  { id: 'learning', icon: 'fa-graduation-cap' },
];

export const BADGES_DEFINITIONS = [
  { id: 'first_step', icon: 'fa-shoe-prints' },
  { id: 'on_fire', icon: 'fa-fire' },
  { id: 'milestone_master', icon: 'fa-flag-checkered' },
  { id: 'night_owl', icon: 'fa-moon' },
  { id: 'early_bird', icon: 'fa-sun' },
];