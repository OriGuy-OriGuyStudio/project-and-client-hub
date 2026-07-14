# מחשבון תמחור + הצעת מחיר ללקוח , ספק פאזה A

**מטרה:** כלי אדמין חדש בפורטל שבונה הצעת מחיר לפרויקט אתר (מחיר בסיס + עמודים×מורכבות +
פיצ'רים×מורכבות + מרווח ביטחון), ומייצר **דף הצעה יפה ללקוח** עם מוצרי אפסייל, בחירת חבילת
תחזוקה אופציונלית, תצוגת מחיר עם/בלי מע"מ, וחתימה דיגיטלית לאישור.

מבוסס על הרפרנס של אורי (מחשבון תמחור עם מכפילי מורכבות) + דף הצעה עם UPSELL (paneliner).
עיצוב וחווית המשתמש של **דף הלקוח** קריטיים ("זה מוכר מאוד"), נבנה ברמת frontend-design/taste.

## מה בפאזה A ומה לא
- **בפנים:** סוגי אתר (תדמית/חנות/אפליקציה/מותאם/נחיתה), מחשבון, אפסיילים, תחזוקה כאפסייל
  אופציונלי, מע"מ, דף לקוח + חתימה.
- **מחוץ (פאזות הבאות):** קטגוריית אוטומציה במחשבון + מבנה שיחת אפיון לאוטומציה (B);
  חבילות תחזוקת אוטומציה + דשבורד ללקוח אוטומציה (C).

## שני תחומים (Surfaces)
1. **בונה אדמין** , `/admin/tools/quote` (רשימת הצעות + בונה הצעה בודדת).
2. **דף הצעה ללקוח** , `/quote/:token` (ציבורי, בלי התחברות , הלקוח הוא לרוב עדיין ליד).

## מודל נתונים

### טבלה `price_quotes` (הצעה בודדת)
- `id uuid pk`
- `org_id uuid null`, `project_id uuid null` (הצעה יכולה להקדים פרויקט)
- `title text`, `client_name text`
- `site_type text` , 'landing' | 'portfolio' | 'store' | 'app' | 'custom'
- `content jsonb` , כל מבנה ההצעה (מקור האמת לחישוב):
  ```
  {
    base_project, base_page, base_feature,   // מחירי בסיס
    margin_pct,                              // 10 | 20 | 30
    pages:    [{ id, name, mult }],          // mult ∈ 1 | 1.5 | 2
    features: [{ id, name, mult }],
    upsells:  [{ id, title, desc, price }],  // מחיר קבוע לאפסייל
    maintenance: { offer: bool, tiers: ['core','pro','ultra'] },
    vat_pct,                                 // ברירת מחדל 18
    intro, notes                             // טקסט חופשי ללקוח / פנימי
  }
  ```
- `status text` , 'draft' | 'sent' | 'signed' | 'declined' (default 'draft')
- `share_token uuid unique default gen_random_uuid()`
- `selected jsonb default '{}'` , בחירת הלקוח: `{ upsell_ids:[], maintenance_tier:null }`
- חתימה (כמו `service_agreements`): `signed_name text`, `signed_at timestamptz`, `signature text`
- snapshot בעת חתימה: `accepted_one_time numeric`, `accepted_monthly numeric`
- `created_at`, `updated_at`

### טבלה `quote_catalog` (פריטים "מוכנים", אדמין עורך)
מ-"ערוך עמודים/פיצ'רים מוכנים" ו-"טען מוכנים". מאפשר לאורי לתחזק ספריית ברירות מחדל.
- `id uuid pk`, `kind text` ('page' | 'feature' | 'upsell')
- `site_type text null` (null = כל הסוגים)
- `label text`, `description text null`, `base_price numeric null`, `default_mult numeric default 1`
- `sort int default 0`
- seed ראשוני מהסקרינשוט (בית/אודות/שירותים/פורטפוליו/בלוג/צור קשר; מערכת ניהול תוכן/טפסים
  מתקדמים/נגישות מלאה; ועוד) לפי סוג אתר.

## לוגיקת תמחור (טהורה, בקוד משותף `lib/quote.ts`)
- מחיר שורת עמוד/פיצ'ר = `base × mult`.
- `pagesTotal = Σ pages`, `featuresTotal = Σ features`.
- `subtotal = base_project + pagesTotal + featuresTotal`.
- `margin = round(subtotal × margin_pct/100)`.
- `oneTimeBase = subtotal + margin`.
- `upsellsTotal = Σ selected upsells`.
- `oneTimeTotal = oneTimeBase + upsellsTotal` (חד-פעמי).
- `monthly = מחיר חבילת התחזוקה שנבחרה` (חודשי, נפרד; מ-`service_plan_content`).
- תצוגה תמיד: **לא כולל מע"מ** ו-**כולל מע"מ** (`× (1 + vat_pct/100)`).

## בונה אדמין (`/admin/tools/quote`)
מרשים אבל מוכר לפי הסקרינשוט:
- טאבים לסוג אתר.
- 3 שדות בסיס (פרויקט / עמוד / פיצ'ר) + טוגל מרווח ביטחון (10/20/30).
- **עמודים:** רשימה , שם + טוגל מורכבות (1x/1.5x/2x) + מחיר שורה מחושב + מחיקה; "הוסף עמוד";
  "טען מוכנים" (מ-`quote_catalog` לפי סוג האתר).
- **פיצ'רים:** זהה.
- **אפסיילים:** כרטיסים (כותרת/תיאור/מחיר), הוסף/מחק, "טען מוכנים".
- טוגל "הצע תחזוקה בדף הלקוח" + בחירת אילו טיירים להציג.
- שם לקוח + כותרת + אחוז מע"מ + טקסט פתיחה ללקוח.
- **Sidebar סיכום** (חי): בסיס, סה"כ עמודים, סה"כ פיצ'רים, מרווח, **סה"כ חד-פעמי (בלי/עם
  מע"מ)**, וחודשי אם נבחרה תחזוקה.
- כפתורים: **שמור**, **תצוגה מקדימה** (דף הלקוח), **העתק לינק** (`/quote/:token`).

## דף הצעה ללקוח (`/quote/:token`) , עיצוב יוצא דופן
במותג הסטודיו (ירוק #B4D670, RTL, כהה), מגדרי לפי הצורך, אנימציות עדינות (gated ל-reduced-motion).
סקשנים:
1. **Hero** , שם הלקוח, כותרת הפרויקט, טקסט פתיחה, מיתוג.
2. **מה כלול** , העמודים והפיצ'רים כרשימת ערך (ברירת מחדל: בלי מחירי שורה, תצוגה נקייה).
3. **המחיר** , חד-פעמי, גדול וברור, לא כולל / כולל מע"מ.
4. **אפסיילים** , כרטיסים עם טוגל; הסכום מתעדכן בזמן אמת; מיקרו-אנימציה כשמוסיפים.
5. **תחזוקה (אופציונלי)** , 3 הטיירים ככרטיסים (שם, מחיר/חודש, פיצ'רים מ-`service_plan_content`),
   בחירה אחת או ללא. **הלקוח לא חייב לבחור.**
6. **חתימה ואישור** , שם + חתימה (ציור על קנבס או הקלדה) + "אני מאשר" →
   `sign_quote(...)`: status='signed', snapshot של הבחירות והסכומים (`accepted_one_time/monthly`),
   `signed_name/at/signature`. מנגנון החתימה זהה ל-`service_agreements`.
- אחרי חתימה: מסך תודה + סיכום מה אושר. אורי מקבל התראה.

## אבטחה (RLS + RPCs)
- `price_quotes`: policy admin-all (`is_admin()`). אין קריאה ישירה ללקוח.
- דף הלקוח דרך token בלבד, שני RPCs definer (כמו discovery-share):
  - `get_quote_public(p_token uuid)` , מחזיר את ההצעה (content + selected + status + org name)
    לפי share_token. ציבורי (anon/authenticated). לא חושף שדות פנימיים מיותרים.
  - `sign_quote(p_token uuid, p_name text, p_signature text, p_upsell_ids jsonb, p_maintenance_tier text)`
    , definer, מעדכן חתימה + בחירות + snapshot, רק אם status ∈ (draft,sent). מחזיר הצלחה.
- `quote_catalog`: admin-all; קריאה ל-anon לא נדרשת (הבונה הוא אדמין; דף הלקוח מקבל מחירי
  תחזוקה מ-`service_plan_content` שכבר ציבורי דרך `usePlanConfig`).
- הערה: כמו בהסכמי שירות, החתימה היא הצהרת כוונות, לא תשלום. אין קלט תשלום/כרטיס בדף.

## קבצים (מפה ראשונית)
- `supabase/migrations/<ts>_price_quotes.sql` , 2 טבלאות + RLS + 2 RPCs + seed קטלוג.
- `src/types/database.ts` , טיפוסי PriceQuote / QuoteCatalog / QuoteContent.
- `src/lib/quote.ts` , לוגיקת החישוב הטהורה + טיפוסים.
- `src/hooks/useQuotes.ts` , רשימה/בודדת/קטלוג + get_quote_public.
- `src/pages/admin/QuoteTool.tsx` (רשימה) + `QuoteBuilder.tsx` (בונה).
- `src/pages/public/QuotePage.tsx` , דף הלקוח + חתימה.
- `src/pages/admin/Tools.tsx` (כרטיס), `src/App.tsx` (routes: /admin/tools/quote, /quote/:token).

## QA (בסוף פאזה A)
1. בונה: צור הצעה, שנה מורכבויות, ראה שהסכום והמע"מ מתעדכנים; הוסף אפסיילים ותחזוקה.
2. "העתק לינק" → פתח `/quote/:token` בגלישה פרטית (בלי התחברות): הכל נטען.
3. בדף הלקוח: סמן אפסיילים + תחזוקה → הסכום מתעדכן; חתום → מסך תודה + התראה לאדמין.
4. חזור לבונה: ראה status=signed + מה הלקוח בחר + החתימה.
5. עיצוב: מובייל + דסקטופ + reduced-motion.
