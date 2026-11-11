export interface Employee {
  id: string;
  name: string;
  entryTime: string | null; // HH:MM format or null if not clocked in
  registroId?: string | null;
  estado?: "sin_fichaje" | "en_jornada" | "jornada_completa";
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type FichajeScreen = "selection" | "action" | "confirm-entry" | "confirm-exit" | "error";
