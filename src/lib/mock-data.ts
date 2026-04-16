import { TeeTime } from "@/types";

const COURSE_IMAGES = [
  "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1592919505780-303950717480?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1600183952086-0bca35aca15e?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?w=400&h=250&fit=crop",
];

const COURSE_NAMES = [
  "Pebble Creek Golf Club",
  "Sunset Ridge Golf Course",
  "Eagle Valley Golf Links",
  "Pine Hills Country Club",
  "Lakewood Municipal Golf Course",
  "Riverside Golf & Country Club",
  "Mountain View Golf Club",
  "Oakmont Golf Course",
  "Willow Springs Golf Club",
  "The Links at Fairway Pines",
  "Harbor Point Golf Club",
  "Cedar Creek Golf Course",
  "Shadow Creek Golf Club",
  "Royal Oaks Golf & Tennis",
  "Greenfield Community Golf Course",
];

const CITIES = [
  "San Francisco",
  "San Jose",
  "Oakland",
  "Palo Alto",
  "Mountain View",
  "Fremont",
  "Santa Clara",
  "Sunnyvale",
  "Hayward",
  "Redwood City",
];

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 6; hour <= 17; hour++) {
    for (const minute of [0, 15, 30, 45]) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
}

function formatDisplayTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minuteStr} ${ampm}`;
}

function generateDate(daysFromNow: number): { iso: string; display: string } {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const iso = date.toISOString();
  const display = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { iso, display };
}

export function generateMockTeeTimes(
  zipCode: string,
  radiusMiles: number
): TeeTime[] {
  const teeTimes: TeeTime[] = [];
  const timeSlots = generateTimeSlots();

  for (let i = 0; i < 30; i++) {
    const courseIndex = i % COURSE_NAMES.length;
    const courseName = COURSE_NAMES[courseIndex];
    const city = CITIES[i % CITIES.length];
    const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
    const daysFromNow = Math.floor(Math.random() * 7) + 1;
    const { iso, display } = generateDate(daysFromNow);

    const isHotDeal = Math.random() < 0.3;
    const basePrice = 30 + Math.floor(Math.random() * 120);
    const discount = isHotDeal
      ? Math.floor(Math.random() * 40) + 20
      : Math.floor(Math.random() * 15);
    const price = Math.round(basePrice * (1 - discount / 100));
    const distance = Math.round(Math.random() * radiusMiles * 10) / 10;
    const rating = Math.round((3 + Math.random() * 2) * 10) / 10;
    const holes = Math.random() > 0.3 ? 18 : 9;

    teeTimes.push({
      id: `tt-${i}-${Date.now()}`,
      courseName,
      courseId: `course-${courseIndex}`,
      address: `${1000 + i * 100} Golf Course Dr`,
      city,
      state: "CA",
      zipCode,
      latitude: 37.3 + Math.random() * 0.5,
      longitude: -122.0 - Math.random() * 0.5,
      dateTime: iso,
      displayTime: formatDisplayTime(timeSlot),
      displayDate: display,
      players: Math.floor(Math.random() * 3) + 1,
      holes,
      originalPrice: basePrice,
      price,
      isHotDeal,
      discount,
      rating,
      reviewCount: Math.floor(Math.random() * 500) + 10,
      imageUrl: COURSE_IMAGES[i % COURSE_IMAGES.length],
      bookingUrl: `https://www.golfnow.com/tee-times/facility/${courseIndex}-${courseName.toLowerCase().replace(/\s+/g, "-")}/search`,
      distanceMiles: distance,
    });
  }

  return teeTimes.sort((a, b) => a.price - b.price);
}
