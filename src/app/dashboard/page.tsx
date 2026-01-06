"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Stat = {
  id: string;
  name: string;
  base_value: number;
  xp_total: number;
};

type Habit = {
  id: string;
  user_id: string;
  stat_id: string;
  name: string;
  xp_value: number;
  frequency: string; // "daily"
  is_active: boolean;
};

type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  stat_id: string;
  log_date: string; // YYYY-MM-DD
  completed: boolean;
  xp_earned: number;
};

type Section = "habits" | "tasks" | "character";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** =========================
 *  ✅ CURVA DE XP (EXP)
 *  base en nivel 1 = 100 XP
 *  crecimiento = 4% por nivel
 *  ========================= */
const XP_BASE = 100;
const XP_GROWTH = 1.04; // subilo a 1.045 / 1.05 si querés más difícil
const MAX_LEVEL = 100;

function xpToNextLevel(level: number) {
  const L = Math.max(1, Math.min(level, MAX_LEVEL));
  return Math.round(XP_BASE * Math.pow(XP_GROWTH, L - 1));
}

/**
 * Nivel inicial = base_value
 * xp_total = XP extra acumulada (sumada por hábitos)
 * Devuelve el nivel real, progreso de XP dentro del nivel actual y % de barra.
 */
function computeStatProgress(baseValue: number, xpTotal: number) {
  let level = Math.max(1, Math.min(baseValue ?? 1, MAX_LEVEL));
  let xp = Math.max(0, xpTotal ?? 0);

  while (level < MAX_LEVEL) {
    const need = xpToNextLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
  }

  const needNow = xpToNextLevel(level);
  const pct = needNow === 0 ? 0 : Math.round((xp / needNow) * 100);

  return {
    level,
    xpIntoLevel: xp,
    xpNeeded: needNow,
    pct: Math.max(0, Math.min(100, pct)),
    xpToNext: Math.max(0, needNow - xp),
  };
}

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<Stat[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([]);

  const [section, setSection] = useState<Section>("habits");

  // ✅ form crear hábito
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitXp, setNewHabitXp] = useState(10);
  const [newHabitStatId, setNewHabitStatId] = useState<string>("");

  const today = useMemo(() => todayISODate(), []);

  /** =========================
   *  🎮 PIXEL UI (OSCURA CRT)
   *  ========================= */
  const ui = {
    page: "min-h-screen bg-[#0b1020] text-[#e6e6e6]",
    shell: "max-w-6xl mx-auto p-6",
    title: "text-2xl font-bold tracking-wide",
    sub: "mt-2 text-sm text-[#9aa4bf]",
    panel:
      "bg-[#141b2d] border-2 border-[#2b3353] shadow-[6px_6px_0px_#000] p-5",
    panelSoft:
      "bg-[#11182b] border-2 border-[#2b3353] shadow-[6px_6px_0px_#000] p-5",
    row: "flex items-center justify-between gap-4",
    tabBase:
      "px-4 py-2 border-2 border-[#2b3353] bg-[#11182b] shadow-[4px_4px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000] transition-all",
    tabActive:
      "px-4 py-2 border-2 border-[#37ff8b] bg-[#0f2a1c] text-[#37ff8b] shadow-[4px_4px_0px_#000] transition-all",
    btn:
      "px-4 py-2 border-2 border-[#2b3353] bg-[#1b2440] shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    btnDanger:
      "px-4 py-2 border-2 border-[#7a2e2e] bg-[#2a0f10] text-[#ff8a8a] shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all",
    input:
      "px-3 py-2 border-2 border-[#2b3353] bg-[#0f1426] text-[#e6e6e6] outline-none focus:border-[#37ff8b]",
    select:
      "px-3 py-2 border-2 border-[#2b3353] bg-[#0f1426] text-[#e6e6e6] outline-none focus:border-[#37ff8b]",
    badgeOk:
      "px-2 py-1 border-2 border-[#37ff8b] bg-[#0f2a1c] text-[#37ff8b] text-xs",
    badgeMuted:
      "px-2 py-1 border-2 border-[#2b3353] bg-[#0f1426] text-[#9aa4bf] text-xs",
    barWrap: "h-4 border-2 border-[#2b3353] bg-[#0f1426]",
    barFill:
      "h-full bg-gradient-to-r from-[#37ff8b] to-[#20d46f] shadow-[0_0_10px_rgba(55,255,139,0.25)]",
    grid: "mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6",
    main: "lg:col-span-2 space-y-6",
    side: "space-y-6",
    avatarFrame:
      "w-full aspect-square border-2 border-[#37ff8b] bg-[#0f1426] shadow-[6px_6px_0px_#000] flex items-center justify-center overflow-hidden",
  };

  async function reloadHabitsActive() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("habits")
      .select("id, user_id, stat_id, name, xp_value, frequency, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error recargando hábitos:", error);
      return;
    }

    setHabits(data ?? []);
  }

  // 1) Proteger ruta
  useEffect(() => {
    let alive = true;

    async function protect() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (!data.session) {
        router.replace("/login");
        return;
      }

      setEmail(data.session.user.email ?? null);
      setLoading(false);
    }

    protect();
    return () => {
      alive = false;
    };
  }, [router]);

  // 2) Cargar stats
  useEffect(() => {
    let alive = true;

    async function loadStats() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("stats")
        .select("id, name, base_value, xp_total")
        .eq("user_id", user.id)
        .order("name");

      if (!alive) return;

      if (error) {
        console.error("Error cargando stats:", error);
        return;
      }

      const list = data ?? [];
      setStats(list);

      if (list.length > 0 && !newHabitStatId) {
        setNewHabitStatId(list[0].id);
      }
    }

    loadStats();
    return () => {
      alive = false;
    };
  }, [newHabitStatId]);

  // 3) Cargar hábitos (activos)
  useEffect(() => {
    let alive = true;

    async function loadHabits() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("habits")
        .select("id, user_id, stat_id, name, xp_value, frequency, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");

      if (!alive) return;

      if (error) {
        console.error("Error cargando hábitos:", error);
        return;
      }

      setHabits(data ?? []);
    }

    loadHabits();
    return () => {
      alive = false;
    };
  }, []);

  // 4) Cargar logs de HOY
  useEffect(() => {
    let alive = true;

    async function loadTodayLogs() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("habit_logs")
        .select("id, habit_id, user_id, stat_id, log_date, completed, xp_earned")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .eq("completed", true);

      if (!alive) return;

      if (error) {
        console.error("Error cargando logs:", error);
        return;
      }

      setTodayLogs(data ?? []);
    }

    loadTodayLogs();
    return () => {
      alive = false;
    };
  }, [today]);

  const completedHabitIdsToday = useMemo(() => {
    return new Set(todayLogs.map((l) => l.habit_id));
  }, [todayLogs]);

  const habitById = useMemo(() => {
    const map = new Map<string, Habit>();
    habits.forEach((h) => map.set(h.id, h));
    return map;
  }, [habits]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ✅ Resumen de hoy
  const habitsDoneToday = useMemo(() => {
    return new Set(todayLogs.map((l) => l.habit_id)).size;
  }, [todayLogs]);

  const totalHabitsToday = habits.length;

  const xpGainedToday = useMemo(() => {
    return todayLogs.reduce((sum, l) => sum + (l.xp_earned ?? 0), 0);
  }, [todayLogs]);

  const todayProgressPct = useMemo(() => {
    if (totalHabitsToday === 0) return 0;
    return Math.round((habitsDoneToday / totalHabitsToday) * 100);
  }, [habitsDoneToday, totalHabitsToday]);

  // ✅ sumar XP a stat
  async function addXp(statId: string, amount: number) {
    const stat = stats.find((s) => s.id === statId);
    if (!stat) return;

    const newXp = (stat.xp_total ?? 0) + amount;

    const { error } = await supabase
      .from("stats")
      .update({ xp_total: newXp })
      .eq("id", statId);

    if (error) {
      console.error(error);
      alert("Error sumando XP");
      return;
    }

    setStats((prev) =>
      prev.map((s) => (s.id === statId ? { ...s, xp_total: newXp } : s))
    );
  }

  // ✅ crear hábito nuevo (fix: maybeSingle + fallback reload)
  async function createHabit() {
    const name = newHabitName.trim();
    if (!name) {
      alert("Poné un nombre para el hábito");
      return;
    }
    if (!newHabitStatId) {
      alert("Elegí un stat");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing, error: checkErr } = await supabase
      .from("habits")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", name)
      .limit(1);

    if (checkErr) {
      console.error(checkErr);
      alert("Error verificando duplicados");
      return;
    }

    if (existing && existing.length > 0) {
      alert("Ya tenés un hábito con ese nombre.");
      return;
    }

    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: user.id,
        name,
        stat_id: newHabitStatId,
        xp_value: Number(newHabitXp) || 0,
        frequency: "daily",
        is_active: true,
      })
      .select("id, user_id, stat_id, name, xp_value, frequency, is_active")
      .maybeSingle();

    if (error) {
      console.error(error);
      alert("Error creando hábito");
      return;
    }

    setNewHabitName("");
    setNewHabitXp(10);

    if (data) {
      setHabits((prev) => {
        const next = [data as Habit, ...prev];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
    } else {
      // fallback (por si no devuelve row)
      await reloadHabitsActive();
    }

    alert("✅ Hábito creado!");
  }

  // ✅ crear hábitos iniciales
  async function initializeHabits() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: existing, error: existingError } = await supabase
      .from("habits")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (existingError) {
      console.error(existingError);
      alert("Error verificando hábitos");
      return;
    }

    if (existing && existing.length > 0) {
      alert("Tus hábitos ya están creados.");
      return;
    }

    const { data: userStats, error: statsError } = await supabase
      .from("stats")
      .select("id, name")
      .eq("user_id", user.id);

    if (statsError) {
      console.error(statsError);
      alert("Error cargando stats");
      return;
    }

    const statIdByName = new Map(
      (userStats ?? []).map((s: any) => [s.name, s.id])
    );

    function idOf(statName: string) {
      const id = statIdByName.get(statName);
      if (!id) throw new Error(`No existe el stat: ${statName}`);
      return id;
    }

    let rows: any[] = [];
    try {
      rows = [
        {
          user_id: user.id,
          name: "Entrenar (30-45 min)",
          stat_id: idOf("Energía"),
          xp_value: 25,
          frequency: "daily",
          is_active: true,
        },
        {
          user_id: user.id,
          name: "Caminar 20 min",
          stat_id: idOf("Energía"),
          xp_value: 10,
          frequency: "daily",
          is_active: true,
        },
        {
          user_id: user.id,
          name: "Bloque profundo 45 min (sin distracciones)",
          stat_id: idOf("Enfoque"),
          xp_value: 20,
          frequency: "daily",
          is_active: true,
        },
        {
          user_id: user.id,
          name: "Plan del día (5 min)",
          stat_id: idOf("Disciplina"),
          xp_value: 10,
          frequency: "daily",
          is_active: true,
        },
        {
          user_id: user.id,
          name: "Estudio / lectura 30 min",
          stat_id: idOf("Aprendizaje"),
          xp_value: 20,
          frequency: "daily",
          is_active: true,
        },
        {
          user_id: user.id,
          name: "Oración / reflexión 10 min",
          stat_id: idOf("Espiritualidad"),
          xp_value: 15,
          frequency: "daily",
          is_active: true,
        },
      ];
    } catch (e: any) {
      console.error(e);
      alert(e.message);
      return;
    }

    const { error } = await supabase.from("habits").insert(rows);

    if (error) {
      console.error(error);
      alert("Error creando hábitos");
      return;
    }

    alert("✅ Hábitos creados!");
    await reloadHabitsActive();
  }

  // ✅ inicializar personaje (reset limpio: crea base stats + xp_total=0)
  async function initializeCharacter() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: existingStats, error: checkError } = await supabase
      .from("stats")
      .select("id")
      .eq("user_id", user.id);

    if (checkError) {
      console.error(checkError);
      alert("Error verificando stats");
      return;
    }

    if (existingStats && existingStats.length > 0) {
      alert("Tu personaje ya está inicializado.");
      return;
    }

    const baseStats = [
      { name: "Enfoque", base_value: 62 },
      { name: "Energía", base_value: 60 },
      { name: "Aprendizaje", base_value: 78 },
      { name: "Disciplina", base_value: 55 },
      { name: "Vínculos", base_value: 70 },
      { name: "Espiritualidad", base_value: 65 },
    ];

    const rows = baseStats.map((stat) => ({
      user_id: user.id,
      name: stat.name,
      base_value: stat.base_value,
      xp_total: 0,
    }));

    const { error } = await supabase.from("stats").insert(rows);

    if (error) {
      console.error(error);
      alert("Error al inicializar el personaje");
      return;
    }

    alert("🎮 Personaje inicializado!");

    const { data, error: reloadError } = await supabase
      .from("stats")
      .select("id, name, base_value, xp_total")
      .eq("user_id", user.id)
      .order("name");

    if (reloadError) {
      console.error(reloadError);
      return;
    }

    setStats(data ?? []);
  }

  // ✅ completar hábito
  async function completeHabit(habit: Habit) {
    if (completedHabitIdsToday.has(habit.id)) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error: insertError } = await supabase.from("habit_logs").insert({
      user_id: user.id,
      habit_id: habit.id,
      stat_id: habit.stat_id,
      log_date: today,
      completed: true,
      xp_earned: habit.xp_value,
    });

    if (insertError) {
      console.error(insertError);
      alert("Este hábito ya fue completado hoy.");
      return;
    }

    await addXp(habit.stat_id, habit.xp_value);

    setTodayLogs((prev) => [
      ...prev,
      {
        id: `local-${habit.id}-${today}`,
        user_id: user.id,
        habit_id: habit.id,
        stat_id: habit.stat_id,
        log_date: today,
        completed: true,
        xp_earned: habit.xp_value,
      },
    ]);
  }

  // ✅ Reset TOTAL desde UI (opcional). Requiere RLS que permita delete/update por auth.uid().
  async function resetAll() {
    const ok = confirm(
      "⚠️ Esto borra logs, hábitos y stats. Vas a arrancar de cero.\n\n¿Confirmás?"
    );
    if (!ok) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // borrar logs
    {
      const { error } = await supabase.from("habit_logs").delete().eq("user_id", user.id);
      if (error) console.error("Error borrando logs:", error);
    }

    // borrar hábitos
    {
      const { error } = await supabase.from("habits").delete().eq("user_id", user.id);
      if (error) console.error("Error borrando hábitos:", error);
    }

    // borrar stats
    {
      const { error } = await supabase.from("stats").delete().eq("user_id", user.id);
      if (error) console.error("Error borrando stats:", error);
    }

    setHabits([]);
    setStats([]);
    setTodayLogs([]);
    setNewHabitName("");
    setNewHabitXp(10);
    setNewHabitStatId("");
    setSection("tasks");

    alert("✅ Reset listo. Ahora inicializá el personaje y los hábitos.");
  }

  if (loading) {
    return <div className={`${ui.page} ${ui.shell}`}>Cargando...</div>;
  }

  return (
    <div className={ui.page}>
      <div className={ui.shell}>
        {/* Header */}
        <div className={ui.row}>
          <div>
            <h1 className={ui.title}>📟 Oficina del Aventurero</h1>
            <p className={ui.sub}>Empleado logueado: {email ?? "..."}</p>
          </div>
          <button className={ui.btnDanger} onClick={logout}>
            Salir
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className={section === "habits" ? ui.tabActive : ui.tabBase}
            onClick={() => setSection("habits")}
          >
            🗡 Misiones
          </button>
          <button
            className={section === "tasks" ? ui.tabActive : ui.tabBase}
            onClick={() => setSection("tasks")}
          >
            🛠 Gestión
          </button>
          <button
            className={section === "character" ? ui.tabActive : ui.tabBase}
            onClick={() => setSection("character")}
          >
            🧑‍💼 Personaje
          </button>
        </div>

        {/* Layout */}
        <div className={ui.grid}>
          <div className={ui.main}>
            {/* ======================= */}
            {/* ====== HÁBITOS ======== */}
            {/* ======================= */}
            {section === "habits" && (
              <>
                {/* Resumen */}
                <div className={ui.panel}>
                  <div className={ui.row}>
                    <h2 className="text-lg font-bold">🧭 Progreso de hoy</h2>
                    <span className="text-xs text-[#9aa4bf]">{today}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div className={ui.panelSoft}>
                      <div className="text-[#9aa4bf] text-xs">Misiones</div>
                      <div className="text-lg font-bold">
                        {habitsDoneToday}/{totalHabitsToday}
                      </div>
                    </div>
                    <div className={ui.panelSoft}>
                      <div className="text-[#9aa4bf] text-xs">XP del día</div>
                      <div className="text-lg font-bold text-[#37ff8b]">
                        +{xpGainedToday}
                      </div>
                    </div>
                    <div className={ui.panelSoft}>
                      <div className="text-[#9aa4bf] text-xs">Avance</div>
                      <div className="text-lg font-bold">{todayProgressPct}%</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className={ui.barWrap}>
                      <div
                        className={ui.barFill}
                        style={{ width: `${todayProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Lista de hábitos */}
                <div className={ui.panel}>
                  <div className={ui.row}>
                    <h2 className="text-lg font-bold">📌 Misiones de hoy</h2>
                    <span className={ui.badgeMuted}>daily</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {habits.length === 0 && (
                      <div className="text-sm text-[#9aa4bf]">
                        No tenés misiones activas. Andá a 🛠 Gestión para crear.
                      </div>
                    )}

                    {habits.map((habit) => {
                      const doneToday = completedHabitIdsToday.has(habit.id);

                      return (
                        <div
                          key={habit.id}
                          className={[
                            "border-2 p-4 shadow-[4px_4px_0px_#000] transition-all",
                            doneToday
                              ? "border-[#37ff8b] bg-[#0f2a1c]"
                              : "border-[#2b3353] bg-[#11182b]",
                          ].join(" ")}
                        >
                          <div className={ui.row}>
                            <div>
                              <div className="font-bold">{habit.name}</div>
                              <div className="text-xs text-[#9aa4bf]">
                                +{habit.xp_value} XP
                              </div>
                            </div>

                            {doneToday ? (
                              <span className={ui.badgeOk}>✔ Completada</span>
                            ) : (
                              <button
                                className={ui.btn}
                                onClick={() => completeHabit(habit)}
                              >
                                Completar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hecho hoy */}
                {todayLogs.length > 0 && (
                  <div className={ui.panel}>
                    <h2 className="text-lg font-bold">📜 Completadas</h2>
                    <div className="mt-3 space-y-2">
                      {todayLogs.map((log) => {
                        const h = habitById.get(log.habit_id);
                        return (
                          <div
                            key={log.id}
                            className="border-2 border-[#2b3353] bg-[#11182b] p-3 shadow-[4px_4px_0px_#000] flex items-center justify-between"
                          >
                            <span className="text-sm">
                              {h?.name ?? "Misión"}{" "}
                              <span className="text-[#9aa4bf] text-xs">
                                (+{log.xp_earned})
                              </span>
                            </span>
                            <span className="text-[#37ff8b]">✔</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ======================= */}
            {/* ====== TAREAS ========= */}
            {/* ======================= */}
            {section === "tasks" && (
              <>
                <div className={ui.panel}>
                  <h2 className="text-lg font-bold">🛠 Gestión</h2>
                  <p className="text-sm text-[#9aa4bf] mt-1">
                    Inicializá el juego, creá misiones y reseteá si hace falta.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className={ui.btn} onClick={initializeCharacter}>
                      Inicializar personaje
                    </button>
                    <button className={ui.btn} onClick={initializeHabits}>
                      Crear misiones iniciales
                    </button>
                    <button className={ui.btnDanger} onClick={resetAll}>
                      Reset TOTAL
                    </button>
                  </div>
                </div>

                <div className={ui.panel}>
                  <h2 className="text-lg font-bold">➕ Crear misión</h2>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <input
                      className={ui.input}
                      placeholder="Nombre de la misión"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                    />

                    <select
                      className={ui.select}
                      value={newHabitStatId}
                      onChange={(e) => setNewHabitStatId(e.target.value)}
                    >
                      {stats.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <input
                      className={ui.input}
                      style={{ width: 110 }}
                      type="number"
                      min={0}
                      value={newHabitXp}
                      onChange={(e) => setNewHabitXp(Number(e.target.value))}
                    />

                    <button className={ui.btn} onClick={createHabit}>
                      Crear
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-[#9aa4bf]">
                    Tip: elegí stat + XP. La curva de nivel usa base 100 XP y
                    crecimiento {XP_GROWTH}.
                  </p>
                </div>
              </>
            )}

            {/* ======================= */}
            {/* ===== PERSONAJE ======= */}
            {/* ======================= */}
            {section === "character" && (
              <>
                <div className={ui.panel}>
                  <h2 className="text-lg font-bold">📈 Atributos</h2>
                  <p className="text-sm text-[#9aa4bf] mt-1">
                    Nivel inicial = Base. XP extra te sube niveles con curva exponencial.
                  </p>
                </div>

                {stats.length > 0 && (
                  <div className={ui.panel}>
                    <div className="mt-2 space-y-4">
                      {stats.map((stat) => {
                        const p = computeStatProgress(stat.base_value, stat.xp_total);

                        return (
                          <div
                            key={stat.id}
                            className="border-2 border-[#2b3353] bg-[#11182b] p-4 shadow-[4px_4px_0px_#000]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{stat.name}</span>
                              <span className="text-sm text-[#9aa4bf]">
                                Nivel{" "}
                                <span className="text-[#37ff8b] font-bold">
                                  {p.level}
                                </span>
                              </span>
                            </div>

                            <div className="mt-3">
                              <div className={ui.barWrap}>
                                <div
                                  className={ui.barFill}
                                  style={{ width: `${p.pct}%` }}
                                />
                              </div>

                              <div className="mt-2 text-xs text-[#9aa4bf]">
                                {p.xpIntoLevel} / {p.xpNeeded} XP · faltan{" "}
                                {p.xpToNext} XP
                              </div>
                              <div className="mt-1 text-xs text-[#9aa4bf]">
                                Base: {stat.base_value}/100 · XP acumulada:{" "}
                                {stat.xp_total ?? 0}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar (avatar) */}
          <div className={ui.side}>
            <div className={ui.panel}>
              <div className="flex items-center justify-between">
                <div className="font-bold">🧍 Avatar</div>
                <span className={ui.badgeMuted}>pixel</span>
              </div>

              <div className="mt-4">
                <div className={ui.avatarFrame}>
                  {/* ✅ Si la guardaste en /public: usa src="/avatar.png" */}
                  <img
                    src="https://imgur.com/7NNHnFY.png"
                    alt="Avatar pixel"
                    className="pixel w-full h-full object-contain select-none"
                    draggable={false}
                  />
                </div>

                <p className="mt-3 text-xs text-[#9aa4bf]">
                  Tip: render pixel con{" "}
                  <span className="text-[#37ff8b]">image-rendering: pixelated</span>.
                </p>
              </div>
            </div>

            <div className={ui.panel}>
              <div className="font-bold">⚙️ Curva de nivel</div>
              <p className="mt-2 text-sm text-[#9aa4bf]">
                XP(level→level+1) = round({XP_BASE} × {XP_GROWTH}
                ^(level-1))
              </p>
              <p className="mt-2 text-sm text-[#9aa4bf]">
                Ajuste rápido: si querés más difícil, subí{" "}
                <span className="text-[#37ff8b] font-bold">XP_GROWTH</span>{" "}
                a 1.045 o 1.05.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pixel art rendering helper */}
      <style jsx global>{`
        img.pixel,
        canvas.pixel {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}
