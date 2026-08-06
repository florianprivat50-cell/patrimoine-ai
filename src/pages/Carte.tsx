import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "../components/ui";
import { computeDeal, effectiveProjectInputs, VERDICT_META } from "../lib/deal";
import { fmtEUR, fmtPct } from "../lib/finance";
import { useStore } from "../store";
import { Asset, RealEstateProject } from "../types";

type MapItem =
  | { kind: "project"; id: string; lat: number; lng: number; title: string; subtitle: string; project: RealEstateProject }
  | { kind: "asset"; id: string; lat: number; lng: number; title: string; subtitle: string; asset: Asset };

const FRANCE_CENTER: [number, number] = [46.6, 2.4];

function markerIcon(color: string, big: boolean) {
  const size = big ? 30 : 24;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export default function Carte() {
  const { projects, assets } = useStore();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<MapItem | null>(null);

  const items: MapItem[] = useMemo(() => {
    const out: MapItem[] = [];
    for (const p of projects) {
      if (p.lat != null && p.lng != null) {
        out.push({
          kind: "project",
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.name || `${p.propertyType ?? "Bien"} — ${p.city ?? ""}`,
          subtitle: `${p.city ?? ""} · ${fmtEUR(p.price)}`,
          project: p,
        });
      }
    }
    for (const a of assets) {
      if (a.category === "immobilier" && a.lat != null && a.lng != null) {
        out.push({
          kind: "asset",
          id: a.id,
          lat: a.lat,
          lng: a.lng,
          title: a.name,
          subtitle: `${a.subtype}${a.city ? ` · ${a.city}` : ""} · ${fmtEUR(a.currentValue)}`,
          asset: a,
        });
      }
    }
    return out;
  }, [projects, assets]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView(FRANCE_CENTER, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const layer = markersLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();

    items.forEach((it) => {
      let color = "#0b7a55";
      if (it.kind === "project") {
        const deal = computeDeal(effectiveProjectInputs(it.project));
        color = VERDICT_META[deal.verdict].color;
      }
      const marker = L.marker([it.lat, it.lng], { icon: markerIcon(color, it.kind === "project") });
      marker.on("click", () => setSelected(it));
      marker.addTo(layer);
    });

    if (items.length > 0) {
      const bounds = L.latLngBounds(items.map((i) => [i.lat, i.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [items]);

  return (
    <div className="space-y-5">
      <PageHeader title="Carte" subtitle="Vos opportunités analysées et vos biens immobiliers, géolocalisés" />

      {items.length === 0 ? (
        <EmptyState
          title="Aucun bien localisé"
          body="Renseignez une adresse dans « Analyser un bien » ou dans un actif immobilier, puis cliquez sur « Localiser » pour le faire apparaître ici."
          cta={
            <button className="btn-primary" onClick={() => navigate("/projets")}>
              Analyser un bien
            </button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="!p-0 overflow-hidden">
            <div ref={mapRef} style={{ height: "min(70dvh, 640px)", width: "100%" }} />
          </Card>

          <div className="space-y-3">
            <Card>
              <SectionTitle>Légende</SectionTitle>
              <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: VERDICT_META.accepter.color }} />
                  Opportunité — Accepter
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: VERDICT_META.negocier.color }} />
                  Opportunité — Négocier
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: VERDICT_META.refuser.color }} />
                  Opportunité — Refuser
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: "#0b7a55" }} />
                  Bien détenu (patrimoine)
                </div>
              </div>
            </Card>

            {selected ? (
              <SelectedCard item={selected} onOpen={() => navigate(selected.kind === "project" ? "/projets" : "/patrimoine")} />
            ) : (
              <Card>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Cliquez sur un repère pour voir le détail du bien.
                </p>
              </Card>
            )}

            <Card>
              <SectionTitle>Biens localisés ({items.length})</SectionTitle>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {items.map((it) => (
                  <li key={`${it.kind}-${it.id}`}>
                    <button
                      className="w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:brightness-95"
                      style={{
                        background: selected?.id === it.id ? "var(--page)" : "transparent",
                        color: "var(--text-secondary)",
                      }}
                      onClick={() => {
                        setSelected(it);
                        mapInstance.current?.setView([it.lat, it.lng], 15);
                      }}
                    >
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {it.title}
                      </span>
                      <br />
                      {it.subtitle}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedCard({ item, onOpen }: { item: MapItem; onOpen: () => void }) {
  if (item.kind === "asset") {
    return (
      <Card>
        <SectionTitle>{item.title}</SectionTitle>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {item.subtitle}
        </p>
        <button className="btn-ghost mt-3 w-full text-sm" onClick={onOpen}>
          Voir dans Patrimoine
        </button>
      </Card>
    );
  }
  const deal = computeDeal(effectiveProjectInputs(item.project));
  const meta = VERDICT_META[deal.verdict];
  const r = deal.results.realiste;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{item.title}</SectionTitle>
        <span
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold text-white"
          style={{ background: meta.color, color: deal.verdict === "accepter" ? "#06281c" : "#fff" }}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {item.subtitle}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div style={{ color: "var(--text-muted)" }}>Score</div>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
            {deal.score}/100
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)" }}>Cash-flow</div>
          <div className="font-bold" style={{ color: r.monthlyCashflow >= 0 ? "var(--good-text)" : "var(--critical)" }}>
            {r.monthlyCashflow >= 0 ? "+" : "−"}
            {fmtEUR(Math.abs(r.monthlyCashflow))}/mois
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)" }}>Rendement net</div>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
            {fmtPct(r.netAfterTaxYieldPct)}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)" }}>Offre conseillée</div>
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
            {deal.offerPrice ? fmtEUR(deal.offerPrice) : "—"}
          </div>
        </div>
      </div>
      <Badge tone={deal.verdict === "accepter" ? "good" : deal.verdict === "negocier" ? "warning" : "serious"}>
        {deal.headline}
      </Badge>
      <button className="btn-primary mt-3 w-full text-sm" onClick={onOpen}>
        Ouvrir l'analyse complète
      </button>
    </Card>
  );
}
