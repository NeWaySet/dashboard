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

function getRoomTitleSizeClass(title) {
  const length = String(title ?? "").length;

  if (length <= 5) {
    return "drawer-room-title-short";
  }

  if (length <= 8) {
    return "drawer-room-title-medium";
  }

  if (length <= 12) {
    return "drawer-room-title-long";
  }

  return "drawer-room-title-xlong";
}

export function LessonPanel({ copy, selectedRoom, lessonRoomIndex, moscowTime, selectedDate, onClose }) {
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
    <aside className="panel room-drawer" id="rooms-panel" aria-label={copy.aria}>
      <div className="panel-heading drawer-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className={`drawer-room-title ${getRoomTitleSizeClass(selectedRoom.title)}`}>{selectedRoom.title}</h2>
          <p>
            {copy.campus} {selectedRoom.campusShortName ?? selectedRoom.building}, {copy.floor}{" "}
            {selectedRoom.graphFloor}. {copy.description}
          </p>
        </div>
        <button className="drawer-close" onClick={onClose} type="button" aria-label={copy.closeAria}>
          x
        </button>
      </div>

      <div className="timeline room-pair-list">
        {pairRows.map(({ pair, isCurrentPair, lessons: pairLessons }) => {
          const hasLessons = pairLessons.length > 0;
          const slotClassName = [
            "pair-slot-card",
            hasLessons ? "is-busy" : "is-empty",
            isCurrentPair ? "is-current-pair" : "",
          ].filter(Boolean).join(" ");

          return (
            <article className={slotClassName} key={pair.key}>
              <div className="pair-slot-time">
                <strong>
                  {pair.key} {copy.pair}
                </strong>
                <span>{pair.starts_at}-{pair.ends_at}</span>
                {isCurrentPair ? <em>{copy.now}</em> : null}
              </div>

              <div className="pair-slot-body">
                {hasLessons ? (
                  pairLessons.map((lesson) => {
                    const state = getLessonState(lesson, moscowTime);
                    const past = isLessonPast(lesson, moscowTime);

                    return (
                      <div className={"pair-lesson pair-lesson-" + state} key={lesson.id}>
                        <div>
                          <h3>{lesson.subject}</h3>
                          <p>{lesson.teacher}</p>
                        </div>
                        <div className="lesson-tags">
                          <span>{lesson.group}</span>
                          <span>{past ? copy.finished : state === "active" ? copy.now : copy.next}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="pair-empty-state">{copy.free}</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
