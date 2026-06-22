import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MeshBanner } from "@/components/ui/mesh-banner";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { supabase } from "@/lib/supabase";
import { templateByKey, groupAnswers } from "@/lib/discovery";

interface Summary {
  title: string;
  template_key: string;
  client_summary: string | null;
  answers: Record<string, string>;
  created_at: string;
}

const MESH = ["#16151c", "#1d9e75", "#77becf", "#B4D670", "#91be37"];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function DiscoverySummary() {
  const { token } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["discovery-summary", token],
    enabled: !!token,
    queryFn: async (): Promise<Summary | null> => {
      const { data, error } = await supabase.rpc("get_discovery_summary", {
        p_token: token!,
      });
      if (error) throw error;
      return (data as Summary | null) ?? null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <CenteredLoader label="טוען סיכום…" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <span className="font-heading text-2xl font-bold text-foreground">Orion</span>
        <p className="text-muted-foreground">הסיכום לא נמצא או שהקישור אינו תקין.</p>
      </div>
    );
  }

  const groups = groupAnswers(data.template_key, data.answers ?? {});
  const dateHe = new Date(data.created_at).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-20 text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <MeshBanner colors={MESH} className="h-[clamp(180px,32vh,320px)] w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-3xl px-5 pb-7">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-heading text-lg font-extrabold tracking-wide text-white">
                Orion
              </span>
              <span className="text-sm text-primary">· סטודיו אורי גיא</span>
            </div>
            <h1 className="font-heading text-3xl font-bold text-white drop-shadow sm:text-4xl">
              {data.title}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              סיכום שיחת אפיון · {templateByKey(data.template_key).label} · {dateHe}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
        className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-7"
      >
        {/* Written summary */}
        {data.client_summary && (
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-primary/30 bg-primary/5 p-6"
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="font-heading text-lg font-semibold text-foreground">הסיכום שלי</h2>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">
              {data.client_summary}
            </p>
          </motion.div>
        )}

        {/* Shown answers, grouped by the stages of the call */}
        {groups.map((group) => (
          <motion.div key={group.key} variants={fadeUp} className="space-y-3">
            <h2 className="px-1 font-heading text-lg font-semibold text-primary">{group.title}</h2>
            {group.items.map((it) => (
              <motion.div
                key={it.id}
                variants={fadeUp}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <p className="mb-1.5 font-heading text-sm font-semibold text-muted-foreground">
                  {it.q}
                </p>
                <p className="whitespace-pre-line leading-relaxed text-foreground/90">{it.value}</p>
              </motion.div>
            ))}
          </motion.div>
        ))}

        {!data.client_summary && groups.length === 0 && (
          <motion.p variants={fadeUp} className="py-10 text-center text-muted-foreground">
            הסיכום עדיין בהכנה. נעדכן אותך בקרוב.
          </motion.p>
        )}

        <motion.p variants={fadeUp} className="pt-4 text-center text-xs text-muted-foreground">
          הופק על ידי Orion · סטודיו אורי גיא
        </motion.p>
      </motion.div>
    </div>
  );
}
