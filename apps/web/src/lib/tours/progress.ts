type ProgressStop = {
  arrivalDate?: Date | null;
  departureDate?: Date | null;
};

export function getCompletedStopsCount(Gigs: ProgressStop[]) {
  return Gigs.filter((Gig) => Boolean(Gig.arrivalDate || Gig.departureDate)).length;
}

export function getJourneyProgressPercent(Gigs: ProgressStop[]) {
  if (!Gigs.length) {
    return 0;
  }

  return Math.round((getCompletedStopsCount(Gigs) / Gigs.length) * 100);
}