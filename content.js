/* 열공 위장막 출력 문장 — 전부 팀이 직접 작성한 문장입니다(교재·논문 복사 금지).
   줄 규칙: "# " 제목, "## " 소제목, "- " 목록, ==형광펜==, **굵게** */
'use strict';

const NOTES = {
  biz: {
    name: '경영학원론',
    file: '경영학원론_7주차_필기.pdf',
    text: `# 7주차. 경쟁 전략과 가치 사슬
## 1. 경쟁 우위의 원천
- 기업이 시장에서 살아남으려면 ==남들이 쉽게 따라 할 수 없는 이유==가 있어야 함
- 원가 우위: 같은 품질을 더 싸게 만드는 능력 (규모의 경제, 학습 효과)
- 차별화: 고객이 기꺼이 더 내는 **추가 가치** (브랜드, 디자인, 서비스)
- 집중: 좁은 시장을 정해서 그 안에서만 1등 하기
## 2. 어중간함의 함정
- 원가도 차별화도 아닌 상태 = ==스턱 인 더 미들==
- 예시) 가격은 중간인데 특별한 점도 없는 동네 카페 → 대형 체인과 개인 감성 카페 사이에서 손님을 잃음
- 교수님 강조: "전략은 무엇을 **하지 않을지** 정하는 것"
## 3. 가치 사슬 분석
- 본원적 활동: 구매 물류 → 생산 → 출하 물류 → 마케팅·판매 → 서비스
- 지원 활동: 인사, 기술 개발, 조달, 기반 구조(재무·법무)
- 각 단계에서 ==원가가 어디서 새는지==, 가치가 어디서 생기는지 표시해 보기
- 과제 연결: 팀별로 관심 기업 하나 골라서 가치 사슬 그려 오기 (다음 주 발표)
## 4. 오늘의 정리
- 경쟁 우위 = 원가 or 차별화, 둘 다 노리면 둘 다 놓칠 위험
- 가치 사슬은 "어디에 돈을 쓰고 어디서 돈을 버는가"의 지도
- 시험 포인트: 세 가지 본원적 전략의 **장단점 비교** 서술형 가능성 높음
`
  },
  eng: {
    name: '자료구조',
    file: '자료구조_09_해시테이블.pdf',
    text: `# 9강. 해시 테이블
## 1. 왜 해시인가
- 배열: 인덱스로 O(1) 접근, 하지만 ==키가 숫자가 아니면== 바로 못 씀
- 해시 함수 h(k)로 키를 배열 인덱스로 바꿔서 평균 **O(1)** 탐색
- 좋은 해시 함수 조건: 계산이 빠르고, 결과가 고르게 퍼질 것
## 2. 충돌 처리
- 서로 다른 키가 같은 칸에 들어가는 것 = 충돌 (비둘기집 원리상 피할 수 없음)
- 체이닝: 같은 칸끼리 연결 리스트로 묶음 → 구현 쉬움, 메모리 조금 더 씀
- 개방 주소법: 빈칸을 찾아 옆으로 이동 (선형 탐사, 이차 탐사, 이중 해싱)
- 선형 탐사는 ==1차 군집== 문제 → 데이터가 한쪽에 뭉침
## 3. 적재율과 재해싱
- 적재율 α = 저장된 원소 수 / 테이블 크기
- 체이닝 평균 탐색 비용 ≈ 1 + α/2
- α가 0.75쯤 넘으면 테이블을 **두 배로 늘리고 전부 다시 넣기** (재해싱)
- 재해싱 한 번은 O(n)이지만 나눠 보면 삽입당 평균 O(1) = 분할 상환 분석
## 4. 시험 대비 메모
- 체이닝 vs 개방 주소법 장단점 표로 정리할 것
- 손으로 선형 탐사 삽입 과정 그리는 문제 매년 나옴
- 해시 함수 예: 나눗셈법 h(k) = k mod m, m은 ==2의 거듭제곱을 피한 소수==가 좋음
`
  }
};

const CODE = `"""시간표 충돌 검사기 — 학기 수업 목록에서 겹치는 시간을 찾는다."""
from dataclasses import dataclass
from itertools import combinations


@dataclass(frozen=True)
class Lecture:
    title: str
    day: str          # "월" ~ "금"
    start: int        # 분 단위 (9시 = 540)
    end: int

    def overlaps(self, other: "Lecture") -> bool:
        if self.day != other.day:
            return False
        return self.start < other.end and other.start < self.end


def parse_time(text: str) -> int:
    hour, minute = text.split(":")
    return int(hour) * 60 + int(minute)


def load(rows: list[str]) -> list[Lecture]:
    lectures = []
    for row in rows:
        title, day, start, end = [x.strip() for x in row.split(",")]
        lectures.append(Lecture(title, day, parse_time(start), parse_time(end)))
    return lectures


def find_conflicts(lectures: list[Lecture]) -> list[tuple[Lecture, Lecture]]:
    by_day: dict[str, list[Lecture]] = {}
    for lec in lectures:
        by_day.setdefault(lec.day, []).append(lec)
    conflicts = []
    for day_lectures in by_day.values():
        for a, b in combinations(sorted(day_lectures, key=lambda x: x.start), 2):
            if a.overlaps(b):
                conflicts.append((a, b))
    return conflicts


def free_slots(lectures: list[Lecture], day: str, open_=540, close=1080) -> list[tuple[int, int]]:
    busy = sorted((l.start, l.end) for l in lectures if l.day == day)
    slots, cursor = [], open_
    for start, end in busy:
        if start > cursor:
            slots.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < close:
        slots.append((cursor, close))
    return slots


if __name__ == "__main__":
    data = [
        "자료구조, 월, 09:00, 10:30",
        "경영학원론, 월, 10:00, 11:30",
        "선형대수, 화, 13:00, 14:30",
        "캡스톤디자인, 화, 14:00, 17:00",
    ]
    lectures = load(data)
    for a, b in find_conflicts(lectures):
        print(f"충돌: {a.title} ↔ {b.title} ({a.day})")
    print("월요일 빈 시간:", free_slots(lectures, "월"))
`;

const TERMINAL_LINES = [
  '$ python -m pytest -q',
  '....                                                         [100%]',
  '4 passed in 0.12s',
  '$ python timetable.py',
  '충돌: 자료구조 ↔ 경영학원론 (월)',
  '충돌: 선형대수 ↔ 캡스톤디자인 (화)',
  "월요일 빈 시간: [(690, 1080)]",
  '$ git commit -am "find_conflicts 정렬 기준 수정"',
  '[main 3f9c2a1] find_conflicts 정렬 기준 수정'
];

const SHEET = {
  title: '2학기_팀프로젝트_예산.xlsx',
  cols: ['항목', '9월', '10월', '11월', '12월', '합계'],
  rows: ['재료비', '인쇄비', '교통비', '회의 간식', '소프트웨어', '촬영 장비 대여', '홍보물', '예비비', '설문 사례품', '발표 대관']
};
