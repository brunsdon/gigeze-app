"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OdometerInputsProps = {
  initialStartOdometer?: number;
  initialEndOdometer?: number;
  previousEndOdometer?: number;
  initialBusinessKm?: number;
  initialPersonalKm?: number;
  showBusinessSplit?: boolean;
  onStartOdometerChange?: (value: number | null) => void;
  className?: string;
};

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function incrementValue(value: string, amount: number) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return String(amount);
  }

  return String(Math.max(0, parsed + amount));
}

export function OdometerInputs({
  initialStartOdometer,
  initialEndOdometer,
  previousEndOdometer,
  initialBusinessKm = 0,
  initialPersonalKm = 0,
  showBusinessSplit = true,
  onStartOdometerChange,
  className,
}: OdometerInputsProps) {
  const [startOdometer, setStartOdometer] = useState(
    typeof initialStartOdometer === "number" ? String(initialStartOdometer) : "",
  );
  const [endOdometer, setEndOdometer] = useState(
    typeof initialEndOdometer === "number" ? String(initialEndOdometer) : "",
  );
  const [businessKm, setBusinessKm] = useState(String(initialBusinessKm));
  const [personalKm, setPersonalKm] = useState(String(initialPersonalKm));
  const endOdometerRef = useRef<HTMLInputElement | null>(null);
  const businessKmRef = useRef<HTMLInputElement | null>(null);
  const personalKmRef = useRef<HTMLInputElement | null>(null);

  const tripDistance = useMemo(() => {
    const start = parseNumber(startOdometer);
    const end = parseNumber(endOdometer);

    if (start === null || end === null) {
      return null;
    }

    return end - start;
  }, [endOdometer, startOdometer]);

  const parsedStart = parseNumber(startOdometer);
  const parsedEnd = parseNumber(endOdometer);
  const parsedBusiness = parseNumber(businessKm);
  const parsedPersonal = parseNumber(personalKm);
  const endOdometerError =
    parsedStart !== null && parsedEnd !== null && parsedEnd < parsedStart
      ? "End odometer must be greater than or equal to Start odometer."
      : null;
  const splitSumError =
    tripDistance !== null && parsedBusiness !== null && parsedPersonal !== null && parsedBusiness + parsedPersonal !== tripDistance
      ? `Business and Personal km must sum to trip distance (${tripDistance} km).`
      : null;

  useEffect(() => {
    if (!endOdometerRef.current) {
      return;
    }

    endOdometerRef.current.setCustomValidity(endOdometerError ?? "");
  }, [endOdometerError]);

  useEffect(() => {
    const message = splitSumError ?? "";
    businessKmRef.current?.setCustomValidity(message);
    personalKmRef.current?.setCustomValidity(message);
  }, [splitSumError]);

  useEffect(() => {
    onStartOdometerChange?.(parseNumber(startOdometer));
  }, [onStartOdometerChange, startOdometer]);

  const splitDistance = tripDistance !== null && tripDistance >= 0 ? Math.round(tripDistance) : null;

  function applyPresetSplit(mode: "business" | "personal" | "half") {
    if (splitDistance === null) {
      return;
    }

    if (mode === "business") {
      setBusinessKm(String(splitDistance));
      setPersonalKm("0");
      return;
    }

    if (mode === "personal") {
      setBusinessKm("0");
      setPersonalKm(String(splitDistance));
      return;
    }

    const businessPart = Math.floor(splitDistance / 2);
    const personalPart = splitDistance - businessPart;
    setBusinessKm(String(businessPart));
    setPersonalKm(String(personalPart));
  }

  function rebalancePersonalFromBusiness() {
    if (splitDistance === null) {
      return;
    }

    const businessValue = parseNumber(businessKm);
    if (businessValue === null) {
      return;
    }

    setPersonalKm(String(Math.max(0, splitDistance - businessValue)));
  }

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startOdometer">Start odometer</Label>
          <Input
            id="startOdometer"
            name="startOdometer"
            type="number"
            min={0}
            value={startOdometer}
            onChange={(event) => setStartOdometer(event.target.value)}
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStartOdometer((current) => incrementValue(current, -10))}>
              -10
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStartOdometer((current) => incrementValue(current, -1))}>
              -1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStartOdometer((current) => incrementValue(current, 1))}>
              +1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStartOdometer((current) => incrementValue(current, 10))}>
              +10
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={typeof previousEndOdometer !== "number"}
              onClick={() => {
                if (typeof previousEndOdometer !== "number") {
                  return;
                }

                setStartOdometer(String(previousEndOdometer));
              }}
            >
              Copy previous end
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endOdometer">End odometer</Label>
          <Input
            ref={endOdometerRef}
            id="endOdometer"
            name="endOdometer"
            type="number"
            min={0}
            value={endOdometer}
            onChange={(event) => setEndOdometer(event.target.value)}
            required
            aria-invalid={endOdometerError ? "true" : "false"}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEndOdometer((current) => incrementValue(current, -10))}>
              -10
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEndOdometer((current) => incrementValue(current, -1))}>
              -1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEndOdometer((current) => incrementValue(current, 1))}>
              +1
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEndOdometer((current) => incrementValue(current, 10))}>
              +10
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEndOdometer(startOdometer)}>
              Copy start to end
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={parsedStart === null}
              onClick={() => {
                if (parsedStart === null) {
                  return;
                }

                setEndOdometer(String(parsedStart + 1));
              }}
            >
              End = start +1
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={parsedStart === null}
              onClick={() => {
                if (parsedStart === null) {
                  return;
                }

                setEndOdometer(String(parsedStart + 10));
              }}
            >
              End = start +10
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {tripDistance === null
          ? "Tip: use +1/+10 helpers and quick copy to speed up odometer entry."
          : `Current trip distance: ${tripDistance} km`}
      </p>
      {endOdometerError ? <p className="mt-1 text-xs text-destructive">{endOdometerError}</p> : null}

      {showBusinessSplit ? (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business use</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessKm">Business km</Label>
              <Input
                ref={businessKmRef}
                id="businessKm"
                name="businessKm"
                type="number"
                min={0}
                value={businessKm}
                onChange={(event) => setBusinessKm(event.target.value)}
                required
                aria-invalid={splitSumError ? "true" : "false"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personalKm">Personal km</Label>
              <Input
                ref={personalKmRef}
                id="personalKm"
                name="personalKm"
                type="number"
                min={0}
                value={personalKm}
                onChange={(event) => setPersonalKm(event.target.value)}
                required
                aria-invalid={splitSumError ? "true" : "false"}
              />
            </div>
          </div>
          {splitSumError ? <p className="mt-1 text-xs text-destructive">{splitSumError}</p> : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={splitDistance === null} onClick={() => applyPresetSplit("business")}>
              All business
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={splitDistance === null} onClick={() => applyPresetSplit("personal")}>
              All personal
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={splitDistance === null} onClick={() => applyPresetSplit("half")}>
              50/50
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={splitDistance === null} onClick={rebalancePersonalFromBusiness}>
              Rebalance personal
            </Button>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="businessKm" value="0" />
          <input type="hidden" name="personalKm" value={splitDistance !== null && splitDistance >= 0 ? String(splitDistance) : "0"} />
        </>
      )}
    </div>
  );
}
