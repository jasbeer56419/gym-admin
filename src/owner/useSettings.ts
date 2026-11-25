import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { BusinessSettings } from "../types";

export const defaultSettings: BusinessSettings = {
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  gstin: "",
  gstRate: 0,
  showGst: false,
  receiptNote: "Thank you for being a part of our gym!",
};

export function useSettings(businessId: string | null) {
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);

  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      doc(db, "businesses", businessId, "meta", "settings"),
      (snap) => {
        setSettings({
          ...defaultSettings,
          ...(snap.exists() ? (snap.data() as Partial<BusinessSettings>) : {}),
        });
      },
      () => {
        /* keep defaults if settings cannot be read */
      }
    );
  }, [businessId]);

  return settings;
}