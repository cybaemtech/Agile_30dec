import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionTimerProps {
    expiryTime: number;
    className?: string;
}

export function SessionTimer({ expiryTime, className }: SessionTimerProps) {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isWarning, setIsWarning] = useState(false);
    const [isCritical, setIsCritical] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now();
            const difference = expiryTime - now;

            if (difference <= 0) {
                setTimeLeft("00:00:00");
                setIsCritical(true);
                return;
            }

            // Warning if less than 15 minutes
            setIsWarning(difference < 15 * 60 * 1000);
            // Critical if less than 5 minutes
            setIsCritical(difference < 5 * 60 * 1000);

            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            setTimeLeft(
                `${hours.toString().padStart(2, "0")}:${minutes
                    .toString()
                    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            );
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [expiryTime]);

    if (!timeLeft) return null;

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                isCritical
                    ? "bg-red-100 text-red-700 animate-pulse border-red-200"
                    : isWarning
                        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                        : "bg-white text-neutral-700 border-neutral-200",
                className
            )}
            title="Session Time Remaining"
        >
            <Clock className="h-4 w-4 text-neutral-500" />
            <span className="text-xs text-neutral-500 font-normal mr-1">Session:</span>
            <span className="tabular-nums font-semibold">{timeLeft}</span>
        </div>
    );
}
