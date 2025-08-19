"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function StatusIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    updateStatus(); // initial
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <Badge variant={online ? "default" : "secondary"} className="text-xs">
      {online ? "Online" : "Offline"}
    </Badge>
  );
}
