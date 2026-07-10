# הקמת PRO לאתר לקוח — צ'קליסט אבטחה ותשתית

המסמך הזה מרכז את כל השלבים שהופכים אתר לקוח מ"סתם אתר" ל"אתר מתוחזק ברמת PRO".
חלק מהשלבים כבר אוטומטיים בקוד (מסומן ✅ בקוד), וחלק נעשים ידנית בלוח הבקרה של
Cloudflare / GitHub / Supabase. עבור על הרשימה לכל לקוח חדש שנכנס לחבילת תחזוקה.

---

## מפת השלבים

| שלב | איפה מטופל | סטטוס |
|-----|-----------|-------|
| Turnstile על טפסים ציבוריים | קוד (הפורטל) | ✅ בקוד |
| עדכוני אבטחה לתלויות (Dependabot) | GitHub (`.github/dependabot.yml`) | ✅ בקוד |
| גיבוי DB חיצוני ל-R2 | GitHub Action (`.github/workflows/db-backup.yml`) | ✅ בקוד, דורש הגדרת secrets |
| WAF — חוקים מותאמים | Cloudflare Dashboard | ידני (החוקים למטה) |
| Rate limiting | Cloudflare Dashboard | ידני (למטה) |
| SSL/TLS = Full (strict) + Always HTTPS | Cloudflare Dashboard | ידני |
| ניטור זמינות + PageSpeed | קוד (`poll-site-metrics`) | ✅ בקוד |

---

## 1. Turnstile ✅ (בקוד)

כבר פעיל: טופס החתימה בדף הנחיתה וטופס יצירת הקשר בדף ההפניה מרנדרים Turnstile
ומאמתים את הטוקן דרך edge function `verify-turnstile` לפני שליחה. הסוד יושב ב-
`webhook_secrets['turnstile_secret']`. אין מה לעשות ידנית פר-לקוח, זה חל על הפורטל.

---

## 2. Dependabot ✅ (בקוד)

`.github/dependabot.yml` פותח PR שבועי (יום שני) על עדכוני minor/patch מקובצים, וכן
על ה-Actions עצמם. עדכוני major מסוננים כדי לא לשבור build. **פעם אחת**: ב-GitHub →
Settings → Code security → הפעל "Dependabot alerts" ו-"Dependabot security updates".
מעכשיו רק לבדוק שה-build ירוק ולמזג את ה-PRs.

---

## 3. גיבוי DB חיצוני ל-R2 — הגדרה חד-פעמית

ה-Action `db-backup` עושה `pg_dump` יומי, דוחס ומעלה ל-R2. הוא **מדלג על עצמו** עד
שמגדירים את ה-secrets, אז הוא לא ייכשל לפני שתגדיר אותם.

1. **צור bucket ב-R2**: Cloudflare → R2 → Create bucket, למשל `orion-db-backups`.
2. **צור R2 API Token**: R2 → Manage API Tokens → Create → הרשאת *Object Read & Write*
   ל-bucket הזה. שמור את ה-Access Key ID ואת ה-Secret.
3. **מצא את ה-endpoint**: `https://<account_id>.r2.cloudflarestorage.com`
   (ה-account_id נמצא בעמוד R2).
4. **קח את מחרוזת החיבור ל-DB**: Supabase → Project → Database → Connection string →
   URI (החיבור הישיר, פורט 5432, כולל הסיסמה).
5. **הוסף Secrets ב-GitHub** (Settings → Secrets and variables → Actions → New):
   - `SUPABASE_DB_URL`
   - `R2_ENDPOINT`
   - `R2_BUCKET`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
6. **בדיקה**: Actions → db-backup → Run workflow. אמור להסתיים בירוק וקובץ
   `orion-db-<תאריך>.sql.gz` אמור להופיע ב-bucket.
7. **שמירת מקום**: הגדר ב-R2 lifecycle rule שמוחק אובייקטים מעל ~30 יום.

> שחזור: `gunzip -c orion-db-*.sql.gz | psql "<SUPABASE_DB_URL>"` (על DB ריק/חדש).

---

## 4. WAF — חוקים מותאמים (ידני, פר-דומיין)

Cloudflare → האתר → Security → WAF → Custom rules → Create rule. הדבק את ה-Expression
(מצב Edit expression), ובחר Action. מותאם ל-Free/Pro plan.

### 4.1 חסימת ניסיונות פריצה נפוצים (כל אתר)

- **Expression:**
  ```
  (http.request.uri.path contains "/.env") or
  (http.request.uri.path contains "/.git/") or
  (http.request.uri.path contains "wp-config.php") or
  (http.request.uri.path contains "/vendor/") or
  (http.request.uri.query contains "union select") or
  (http.request.uri.query contains "../")
  ```
- **Action:** Block

### 4.2 אתגר לבוטים אוטומטיים (כל אתר)

- **Expression:**
  ```
  (cf.client.bot) and not (http.user_agent contains "Googlebot") and not (http.user_agent contains "bingbot")
  ```
- **Action:** Managed Challenge

### 4.3 הקשחת WordPress (רק אתרי WP)

- **Expression:**
  ```
  (http.request.uri.path eq "/xmlrpc.php") or
  (http.request.uri.path contains "wp-login.php" and http.request.method eq "POST" and not ip.src in {PUT_YOUR_IP_HERE})
  ```
- **Action:** Managed Challenge
  (החלף `PUT_YOUR_IP_HERE` ב-IP שלך, או הסר את החלק אחרי ה-`and not` אם לא רלוונטי.)

---

## 5. Rate limiting (ידני)

Cloudflare → Security → WAF → Rate limiting rules → Create.

- **When incoming requests match:** `(http.request.method eq "POST")`
- **Rate:** 10 requests / 10 seconds, לפי *IP*
- **Then:** Managed Challenge (או Block ל-1 דקה)

מגן על טפסי התחברות ושליחה מפני הצפה, בלי לפגוע בגלישה רגילה (GET).

---

## 6. SSL/TLS ו-HTTPS (ידני, פעם אחת פר-דומיין)

- SSL/TLS → Overview → **Full (strict)**.
- SSL/TLS → Edge Certificates → **Always Use HTTPS = On**, **Automatic HTTPS Rewrites = On**,
  **Minimum TLS Version = 1.2**.
- Security → Settings → **Bot Fight Mode = On** (ב-Free), או Super Bot Fight Mode (ב-Pro).

---

## סיכום — מה אוטומטי ומה ידני

- **אוטומטי (כבר בקוד):** Turnstile, Dependabot, ניטור מטריקות, ושלד גיבוי ה-R2.
- **ידני פעם אחת פר-דומיין:** חוקי ה-WAF, ה-rate limiting, וה-SSL. אלה יושבים בחשבון
  Cloudflare של האתר ולכן לא ניתנים לאוטומציה מהפורטל.
- **ידני פעם אחת בכלל:** ה-secrets של גיבוי ה-R2 ב-GitHub, והפעלת Dependabot ב-repo.
