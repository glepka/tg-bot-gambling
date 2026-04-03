import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CreateEventPage } from "@/pages/CreateEventPage";
import { EventDetailPage } from "@/pages/EventDetailPage";
import { EventsListPage } from "@/pages/EventsListPage";
import { MyEventsPage } from "@/pages/MyEventsPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<EventsListPage />} />
          <Route path="create" element={<CreateEventPage />} />
          <Route path="my" element={<MyEventsPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
