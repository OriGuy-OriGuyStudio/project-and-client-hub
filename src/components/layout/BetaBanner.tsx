import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, ArrowLeft } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

const KEY = "sog-beta-banner-dismissed-v1";

/**
 * Site-wide "the system is in beta" notice shown across every page until the
 * user closes it (persisted per browser). Its action sends them to leave a note:
 * clients → the profile feedback form, admin → the feedback inbox, partners →
 * an in-app feedback dialog.
 */
export function BetaBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(() => localStorage.getItem(KEY) !== "1");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  function leaveNote() {
    const role = profile?.role;
    if (role === "admin") navigate("/admin/feedback");
    else if (role === "partner") setFeedbackOpen(true);
    else navigate("/profile#feedback");
  }

  return (
    <>
    <Banner
      show={show}
      onHide={dismiss}
      closable
      variant="brand"
      showShade
      className="mb-5"
      icon={<Rocket className="size-5 text-primary" />}
      title="המערכת בהרצה 🚀"
      description="ייתכנו חבלי לידה. מצאת באג, חסר משהו, או יש לך רעיון לשיפור? ספר לי, כל הערה עוזרת."
      action={
        <Button size="sm" variant="secondary" onClick={leaveNote}>
          כתוב הערה <ArrowLeft className="size-3.5" />
        </Button>
      }
    />
    <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
