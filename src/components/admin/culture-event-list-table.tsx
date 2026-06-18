"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import type { CultureEvent } from "@/types/culture-event";

function dateRange(start: Date, end: Date | null): string {
  const f = (d: Date) => new Date(d).toLocaleDateString("ko-KR");
  return end ? `${f(start)} ~ ${f(end)}` : f(start);
}

export function CultureEventListTable({
  events,
}: {
  events: CultureEvent[];
}) {
  const router = useRouter();

  if (events.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">아직 이벤트가 없습니다.</p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">유형</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="w-32">장소</TableHead>
              <TableHead className="w-44">일정</TableHead>
              <TableHead className="w-24">상태</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Badge variant="outline">{event.type}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {event.title}
                    {event.isFeatured && (
                      <Badge
                        variant="outline"
                        className="border-[#6f5c24] text-[#6f5c24]"
                      >
                        추천
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {event.venue || "-"}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {dateRange(event.startDate, event.endDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={event.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted">
                      ...
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/culture-events/${event.id}/edit`)
                        }
                      >
                        수정
                      </DropdownMenuItem>
                      {event.status === "published" && (
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/culture-events/${event.slug}`)
                          }
                        >
                          보기
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/culture-events/${event.id}/edit`}
            className="block rounded-lg border bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline">{event.type}</Badge>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-2 font-medium">{event.title}</p>
            <p className="mt-1 text-xs text-gray-400">
              {event.venue} · {dateRange(event.startDate, event.endDate)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
