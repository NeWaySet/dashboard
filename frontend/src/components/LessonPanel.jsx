import {
  getCurrentPairKey,
  getLessonState,
  isLessonPast,
  minutesToHuman,
  PAIR_SLOTS,
} from "../utils/time.js";
import { getLessonsForRoom } from "../utils/rooms.js";

function lessonOverlapsPair(lesson, pair) {
  const lessonStart = minutesToHuman(lesson.starts_at);
  const lessonEnd = minutesToHuman(lesson.ends_at);

  return lessonStart < pair.ends_at && lessonEnd > pair.starts_at;
}

export function LessonPanel({ selectedRoom, lessonRoomIndex, moscowTime, selectedDate, onClose }) {
  const roomLessons = selectedRoom ? getLessonsForRoom(lessonRoomIndex, selectedRoom) : [];
  const currentPairKey = getCurrentPairKey(moscowTime);
  const pairRows = PAIR_SLOTS.map((pair) => ({
    pair,
    isCurrentPair: pair.key === currentPairKey,
    lessons: roomLessons.filter((lesson) => lessonOverlapsPair(lesson, pair)),
  }));

  if (!selectedRoom) {
    return null;
  }

  return (
    <aside className="panel room-drawer" id="rooms-panel" aria-label="Расписание аудитории">
      <div className="panel-heading drawer-heading">
        <div>
          <p className="eyebrow">Аудитория</p>
          <h2>{selectedRoom.title}</h2>
          <p>
            Корпус {selectedRoom.campusShortName ?? selectedRoom.building}, этаж {selectedRoom.graphFloor}.
            Ниже показаны пары на {selectedDate || "выбранную дату"} с преподавателем, группой и предметом.
          </p>
        </div>
        <button className="drawer-close" onClick={onClose} type="button" aria-label="Закрыть расписание аудитории">
          ×
        </button>
      </div>

      <div className="timeline room-pair-list">
        {pairRows.map(({ pair, isCurrentPair, lessons: pairLessons }) => {
          const hasLessons = pairLessons.length > 0;

          return (
            <article
              className={`pair-slot-card ${hasLessons ? "is-busy" : "is-empty"} ${
                isCurrentPair ? "is-current-pair" : ""
              }`}
              key={pair.key}
            >
              <div className="pair-slot-time">
                <strong>{pair.label}</strong>
                <span>{pair.starts_at}-{pair.ends_at}</span>
                {isCurrentPair ? <em>сейчас</em> : null}
              </div>

              <div className="pair-slot-body">
                {hasLessons ? (
                  pairLessons.map((lesson) => {
                    const state = getLessonState(lesson, moscowTime);
                    const past = isLessonPast(lesson, moscowTime);

                    return (
                      <div className={`pair-lesson pair-lesson-${state}`} key={lesson.id}>
                        <div>
                          <h3>{lesson.subject}</h3>
                          <p>{lesson.teacher}</p>
                        </div>
                        <div className="lesson-tags">
                          <span>{lesson.group}</span>
                          <span>{past ? "завершено" : state === "active" ? "сейчас" : "ожидается"}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="pair-empty-state">Пары нет, аудитория свободна</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
