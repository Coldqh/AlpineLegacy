import { createRng } from './rng';
import type {
  CareerState,
  ClimbPace,
  ExpeditionPhaseNode,
  ExpeditionRoute,
  ExpeditionSimulationStage,
  ParticipantActionTone,
  ParticipantEvaluation,
  ParticipantExpeditionState,
  ParticipantScene,
  ParticipantSceneOption,
  SkillId,
  TeamMember,
} from './types';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const roleSkill: Record<CareerState['expeditionPlan']['playerRole'], SkillId> = {
  LEADER: 'LEADERSHIP',
  ROPE_LEAD: 'ROCK',
  MEDIC: 'MEDICINE',
  NAVIGATOR: 'NAVIGATION',
  SUPPORT: 'ENDURANCE',
};

const roleNames: Record<CareerState['expeditionPlan']['playerRole'], string> = {
  LEADER: 'заместитель руководителя',
  ROPE_LEAD: 'ведущий связки',
  MEDIC: 'медик',
  NAVIGATOR: 'навигатор',
  SUPPORT: 'участник группы',
};

type SceneOptionDraft = Omit<ParticipantSceneOption, 'id' | 'skill'> & { skill?: SkillId | 'ROLE' };

type SceneTemplate = {
  kind: ParticipantScene['kind'];
  title: string;
  situation: string;
  order?: string;
  options: SceneOptionDraft[];
};

function option(
  title: string,
  detail: string,
  tone: ParticipantActionTone,
  effects: Omit<Partial<ParticipantSceneOption>, 'skill'> & { skill?: SkillId | 'ROLE' } = {},
): SceneOptionDraft {
  return {
    title,
    detail,
    tone,
    energyDelta: 0,
    conditionDelta: 0,
    teamDelta: 0,
    leaderTrustDelta: 0,
    groupTrustDelta: 0,
    disciplineDelta: 0,
    initiativeDelta: 0,
    careDelta: 0,
    competenceDelta: 0,
    rankDelta: 0,
    advanceMinutes: 15,
    pace: 'STEADY',
    ...effects,
  };
}

const phaseTemplates: Record<ExpeditionPhaseNode, SceneTemplate[]> = {
  APPROACH: [
    {
      kind: 'ORDER', title: 'Первый груз', situation: 'На тропе группа впервые растягивается. Руководитель перераспределяет общественный груз.', order: 'Возьми бухту верёвки и держись сразу за ведущей связкой.',
      options: [
        option('Взять груз', 'Выполнить приказ и не спорить о весе.', 'OBEY', { energyDelta: -2, leaderTrustDelta: 3, disciplineDelta: 3, advanceMinutes: 35 }),
        option('Попросить заменить часть груза', 'Объяснить, что темп уже выше расчёта.', 'QUESTION', { skill: 'ENDURANCE', skillDifficulty: 42, leaderTrustDelta: -1, competenceDelta: 2, advanceMinutes: 25 }),
        option('Отказаться', 'Оставить груз у ног руководителя.', 'REFUSE', { leaderTrustDelta: -7, groupTrustDelta: -4, disciplineDelta: -5, advanceMinutes: 10, pace: 'CAUTIOUS' }),
      ],
    },
    {
      kind: 'ROLE', title: 'Разрыв колонны', situation: 'Двое участников отстали на осыпном траверсе. Руководитель не замечает разрыв сразу.',
      options: [
        option('Сообщить руководителю', 'Остановить переднюю часть группы.', 'QUESTION', { skill: 'NAVIGATION', skillDifficulty: 38, leaderTrustDelta: 2, careDelta: 2, advanceMinutes: 20, pace: 'CAUTIOUS' }),
        option('Вернуться к отставшим', 'Самому закрыть разрыв и помочь с грузом.', 'CARE', { energyDelta: -3, groupTrustDelta: 4, careDelta: 4, advanceMinutes: 35 }),
        option('Сохранить своё место', 'Не вмешиваться в порядок колонны.', 'OBEY', { disciplineDelta: 1, groupTrustDelta: -1, advanceMinutes: 15, pace: 'FAST' }),
      ],
    },
    {
      kind: 'FIELD', title: 'Неверная тропа', situation: 'Старая маркировка уводит к разрушенному мосту. Следы свежей группы идут выше.',
      options: [
        option('Проверить верхнюю линию', 'Потратить время на короткую разведку.', 'INITIATIVE', { skill: 'NAVIGATION', skillDifficulty: 48, initiativeDelta: 3, competenceDelta: 3, advanceMinutes: 30, pace: 'CAUTIOUS' }),
        option('Идти по приказу', 'Следовать основной колонне.', 'OBEY', { disciplineDelta: 2, advanceMinutes: 20 }),
        option('Позвать напарника и уйти выше', 'Проверить линию без разрешения руководителя.', 'REFUSE', { skill: 'NAVIGATION', skillDifficulty: 55, initiativeDelta: 4, leaderTrustDelta: -4, advanceMinutes: 25, pace: 'FAST' }),
      ],
    },
  ],
  BASE_CAMP: [
    {
      kind: 'ORDER', title: 'Работа лагеря', situation: 'Палатки ещё не закреплены, вода не готова, а ветер усиливается.', order: 'Поставь кухню и растопи первую воду. На собрание придёшь позже.',
      options: [
        option('Сделать всё по порядку', 'Проверить растяжки и только потом запускать горелки.', 'OBEY', { energyDelta: -2, leaderTrustDelta: 3, disciplineDelta: 3, competenceDelta: 1, advanceMinutes: 55 }),
        option('Сначала прийти на разбор маршрута', 'Передать кухню другому участнику.', 'QUESTION', { skill: 'LEADERSHIP', skillDifficulty: 45, initiativeDelta: 2, leaderTrustDelta: -1, advanceMinutes: 35 }),
        option('Сделать только воду', 'Сократить задачу без согласования.', 'REFUSE', { leaderTrustDelta: -4, groupTrustDelta: -2, advanceMinutes: 30 }),
      ],
    },
    {
      kind: 'MORAL', title: 'Чужая слабость', situation: 'Участник рядом дрожит и прячет руки. Он просит не говорить медику.',
      options: [
        option('Позвать медика', 'Нарушить просьбу, но проверить состояние.', 'CARE', { skill: 'MEDICINE', skillDifficulty: 36, careDelta: 4, groupTrustDelta: 2, advanceMinutes: 20 }),
        option('Дать тёплые перчатки', 'Помочь без доклада руководителю.', 'INITIATIVE', { energyDelta: -1, careDelta: 3, groupTrustDelta: 3, advanceMinutes: 15 }),
        option('Не вмешиваться', 'Оставить решение самому участнику.', 'OBEY', { disciplineDelta: 1, careDelta: -2, advanceMinutes: 5 }),
      ],
    },
  ],
  ACCLIMATIZATION: [
    {
      kind: 'ORDER', title: 'Темп акклиматизации', situation: 'Руководитель намеренно держит медленный темп, хотя группа чувствует себя свежей.', order: 'Не обгонять ведущего. Набор высоты сегодня ограничен.',
      options: [
        option('Держать строй', 'Сохранить заданный темп.', 'OBEY', { disciplineDelta: 3, leaderTrustDelta: 2, energyDelta: 1, advanceMinutes: 45, pace: 'CAUTIOUS' }),
        option('Предложить подняться ещё выше', 'Обосновать предложение своим состоянием.', 'QUESTION', { skill: 'ENDURANCE', skillDifficulty: 50, initiativeDelta: 2, leaderTrustDelta: -1, advanceMinutes: 30, pace: 'STEADY' }),
        option('Уйти вперёд', 'Самостоятельно увеличить высоту выхода.', 'REFUSE', { energyDelta: -4, conditionDelta: -2, leaderTrustDelta: -6, disciplineDelta: -5, advanceMinutes: 40, pace: 'FAST' }),
      ],
    },
    {
      kind: 'FIELD', title: 'Первые симптомы', situation: 'Пульс не успокаивается, появляется тупая головная боль. Остальные этого не видят.',
      options: [
        option('Сообщить о состоянии', 'Признать, что акклиматизация идёт плохо.', 'CARE', { careDelta: 2, disciplineDelta: 2, leaderTrustDelta: 2, conditionDelta: 2, advanceMinutes: 20, pace: 'CAUTIOUS' }),
        option('Снизить темп молча', 'Сохранить место в группе, но скрыть симптомы.', 'QUESTION', { skill: 'MEDICINE', skillDifficulty: 46, energyDelta: 1, leaderTrustDelta: -1, advanceMinutes: 20 }),
        option('Продолжить как обычно', 'Не показывать слабость.', 'REFUSE', { conditionDelta: -4, initiativeDelta: 1, advanceMinutes: 15, pace: 'FAST' }),
      ],
    },
    {
      kind: 'ROLE', title: 'Проверка роли', situation: 'На коротком участке руководитель просит тебя выполнить работу по специальности.',
      options: [
        option('Взять задачу', 'Работать аккуратно и показать уровень.', 'OBEY', { skill: 'ROLE', skillDifficulty: 48, competenceDelta: 4, leaderTrustDelta: 3, advanceMinutes: 35 }),
        option('Попросить контроль', 'Выполнить задачу вместе со старшим.', 'QUESTION', { skill: 'ROLE', skillDifficulty: 36, competenceDelta: 3, disciplineDelta: 2, advanceMinutes: 45, pace: 'CAUTIOUS' }),
        option('Отказаться от задачи', 'Сослаться на недостаток опыта.', 'REFUSE', { leaderTrustDelta: -3, competenceDelta: -1, advanceMinutes: 10 }),
      ],
    },
  ],
  CARRY: [
    {
      kind: 'ORDER', title: 'Перенос наверх', situation: 'На складе остаются баллоны, верёвка и топливо. Погода позволяет сделать только один перенос.', order: 'Возьми тяжёлый мешок с топливом. Иди в середине колонны.',
      options: [
        option('Взять тяжёлый мешок', 'Сохранить общий план снабжения.', 'OBEY', { energyDelta: -4, disciplineDelta: 3, groupTrustDelta: 2, advanceMinutes: 55 }),
        option('Предложить разделить топливо', 'Снизить нагрузку на одного человека.', 'QUESTION', { skill: 'LEADERSHIP', skillDifficulty: 44, careDelta: 2, initiativeDelta: 2, advanceMinutes: 35 }),
        option('Взять лёгкую верёвку', 'Самостоятельно поменять назначенный груз.', 'REFUSE', { leaderTrustDelta: -5, disciplineDelta: -4, energyDelta: -1, advanceMinutes: 30 }),
      ],
    },
    {
      kind: 'FIELD', title: 'Слабая полка', situation: 'Складская полка в промежуточном лагере просела. Если оставить всё здесь, часть груза может уйти вниз.',
      options: [
        option('Перенести склад', 'Потратить силы на новую площадку.', 'INITIATIVE', { skill: 'ROCK', skillDifficulty: 45, energyDelta: -3, competenceDelta: 3, groupTrustDelta: 2, advanceMinutes: 40 }),
        option('Позвать руководителя', 'Не менять склад без решения сверху.', 'QUESTION', { disciplineDelta: 2, leaderTrustDelta: 2, advanceMinutes: 20 }),
        option('Закрепить мешки одной петлёй', 'Сделать быстро и уйти вниз.', 'OBEY', { skill: 'ROCK', skillDifficulty: 55, competenceDelta: 1, advanceMinutes: 15, pace: 'FAST' }),
      ],
    },
    {
      kind: 'MORAL', title: 'Чужой груз', situation: 'Напарник просит забрать часть его веса. Он заметно устал, но не хочет сообщать руководителю.',
      options: [
        option('Забрать часть груза', 'Сохранить его в колонне ценой своих сил.', 'CARE', { energyDelta: -3, careDelta: 4, groupTrustDelta: 4, advanceMinutes: 30 }),
        option('Сообщить руководителю', 'Потребовать официального перераспределения.', 'QUESTION', { leaderTrustDelta: 2, careDelta: 2, advanceMinutes: 20 }),
        option('Отказать', 'Оставить каждому назначенный вес.', 'OBEY', { disciplineDelta: 2, groupTrustDelta: -2, advanceMinutes: 15 }),
      ],
    },
  ],
  CAMP: [
    {
      kind: 'ORDER', title: 'Лагерь на высоте', situation: 'Площадка узкая. До темноты остаётся меньше часа.', order: 'Закрепи крайние растяжки и проверь входы палаток.',
      options: [
        option('Проверить каждую точку', 'Потратить время, но оставить лагерь надёжным.', 'OBEY', { skill: 'ROCK', skillDifficulty: 40, competenceDelta: 3, disciplineDelta: 2, advanceMinutes: 45, pace: 'CAUTIOUS' }),
        option('Позвать второго участника', 'Разделить работу и закончить быстрее.', 'INITIATIVE', { skill: 'LEADERSHIP', skillDifficulty: 42, groupTrustDelta: 2, advanceMinutes: 30 }),
        option('Закрепить только на основных точках', 'Сэкономить силы перед следующим днём.', 'REFUSE', { energyDelta: 2, leaderTrustDelta: -3, advanceMinutes: 20, pace: 'FAST' }),
      ],
    },
    {
      kind: 'MORAL', title: 'Ночная очередь', situation: 'Один участник не просыпается на дежурство. Вода ещё не растоплена.',
      options: [
        option('Взять его очередь', 'Потерять сон, но обеспечить лагерь водой.', 'CARE', { energyDelta: -4, careDelta: 4, groupTrustDelta: 3, advanceMinutes: 50 }),
        option('Разбудить и потребовать работу', 'Сохранить свой отдых.', 'OBEY', { skill: 'LEADERSHIP', skillDifficulty: 48, disciplineDelta: 2, groupTrustDelta: -1, advanceMinutes: 20 }),
        option('Оставить всё до утра', 'Не будить человека и не работать самому.', 'REFUSE', { leaderTrustDelta: -4, groupTrustDelta: -3, advanceMinutes: 10 }),
      ],
    },
  ],
  TECHNICAL: [
    {
      kind: 'ORDER', title: 'Работа на верёвке', situation: 'Перед связкой короткий технический барьер. Ошибка задержит всю колонну.', order: 'Выполни свою роль и передай готовность следующему участнику.',
      options: [
        option('Работать по инструкции', 'Сохранить порядок и контроль.', 'OBEY', { skill: 'ROLE', skillDifficulty: 50, competenceDelta: 4, disciplineDelta: 3, leaderTrustDelta: 2, advanceMinutes: 35 }),
        option('Предложить другой приём', 'Использовать более знакомую технику.', 'INITIATIVE', { skill: 'ROLE', skillDifficulty: 58, competenceDelta: 5, initiativeDelta: 3, advanceMinutes: 30, pace: 'FAST' }),
        option('Попросить заменить тебя', 'Передать участок более сильному участнику.', 'QUESTION', { leaderTrustDelta: -1, careDelta: 1, advanceMinutes: 20, pace: 'CAUTIOUS' }),
      ],
    },
    {
      kind: 'FIELD', title: 'Сомнительная точка', situation: 'Чужой карабин стоит поперёк нагрузки. Следующий участник уже готов двигаться.',
      options: [
        option('Исправить молча', 'Остановить движение на несколько минут.', 'CARE', { skill: 'ROCK', skillDifficulty: 36, competenceDelta: 3, careDelta: 3, advanceMinutes: 20 }),
        option('Сообщить руководителю', 'Потребовать повторную проверку всей станции.', 'QUESTION', { leaderTrustDelta: 3, disciplineDelta: 2, advanceMinutes: 30, pace: 'CAUTIOUS' }),
        option('Не задерживать группу', 'Оставить точку как есть.', 'OBEY', { competenceDelta: -2, careDelta: -3, advanceMinutes: 10, pace: 'FAST' }),
      ],
    },
    {
      kind: 'ROLE', title: 'Первый на участке', situation: 'Ведущий устал и предлагает тебе пройти следующую длину первым.',
      options: [
        option('Принять лидерство', 'Взять участок и ответственность.', 'INITIATIVE', { skill: 'ROLE', skillDifficulty: 56, energyDelta: -3, competenceDelta: 5, initiativeDelta: 4, advanceMinutes: 45 }),
        option('Идти под контролем ведущего', 'Принять участок с подсказками.', 'QUESTION', { skill: 'ROLE', skillDifficulty: 43, competenceDelta: 4, disciplineDelta: 2, advanceMinutes: 55, pace: 'CAUTIOUS' }),
        option('Отказаться', 'Сохранить силы и место в связке.', 'REFUSE', { leaderTrustDelta: -3, competenceDelta: -1, advanceMinutes: 15 }),
      ],
    },
    {
      kind: 'MORAL', title: 'Ошибка напарника', situation: 'Напарник роняет часть снаряжения и просит сказать, что оно осталось внизу ещё утром.',
      options: [
        option('Сказать правду', 'Сообщить руководителю о потере.', 'QUESTION', { disciplineDelta: 3, leaderTrustDelta: 3, groupTrustDelta: -2, advanceMinutes: 20 }),
        option('Помочь скрыть ошибку', 'Перераспределить своё снаряжение.', 'CARE', { energyDelta: -2, groupTrustDelta: 3, leaderTrustDelta: -3, advanceMinutes: 20 }),
        option('Не вмешиваться', 'Оставить решение напарнику.', 'OBEY', { disciplineDelta: 1, careDelta: -1, advanceMinutes: 10 }),
      ],
    },
  ],
  HAZARD: [
    {
      kind: 'ORDER', title: 'Опасный траверс', situation: 'Склон простреливается льдом. Руководитель хочет пройти участок без остановки.', order: 'Дистанция десять метров. Не останавливаться под стеной.',
      options: [
        option('Выполнить приказ', 'Пройти участок в заданном темпе.', 'OBEY', { energyDelta: -3, disciplineDelta: 3, advanceMinutes: 30, pace: 'FAST' }),
        option('Потребовать страховку', 'Задержать группу и поставить дополнительную точку.', 'QUESTION', { skill: 'ROCK', skillDifficulty: 48, careDelta: 3, leaderTrustDelta: -1, advanceMinutes: 45, pace: 'CAUTIOUS' }),
        option('Отказаться выходить', 'Остановить свою связку перед опасной зоной.', 'REFUSE', { leaderTrustDelta: -7, disciplineDelta: -5, conditionDelta: 2, advanceMinutes: 20, pace: 'CAUTIOUS' }),
      ],
    },
    {
      kind: 'FIELD', title: 'Изменившийся снег', situation: 'Под ногами появляется глухой звук. Следы ведущего уже уходят на склон.',
      options: [
        option('Крикнуть об опасности', 'Остановить всю колонну.', 'INITIATIVE', { skill: 'NAVIGATION', skillDifficulty: 44, careDelta: 4, initiativeDelta: 3, advanceMinutes: 25, pace: 'CAUTIOUS' }),
        option('Повторять следы', 'Не покидать линию ведущего.', 'OBEY', { disciplineDelta: 2, advanceMinutes: 20 }),
        option('Уйти на камни сбоку', 'Самостоятельно сменить линию.', 'REFUSE', { skill: 'NAVIGATION', skillDifficulty: 58, initiativeDelta: 3, leaderTrustDelta: -4, advanceMinutes: 35 }),
      ],
    },
    {
      kind: 'MORAL', title: 'Падение в связке', situation: 'Участник сзади сорвался на колено. Он встаёт, но заметно хромает.',
      options: [
        option('Остановить связку', 'Проверить травму до продолжения.', 'CARE', { skill: 'MEDICINE', skillDifficulty: 40, careDelta: 5, groupTrustDelta: 3, advanceMinutes: 35, pace: 'CAUTIOUS' }),
        option('Сообщить руководителю на ходу', 'Сохранить движение, передать проблему вверх.', 'QUESTION', { leaderTrustDelta: 2, careDelta: 2, advanceMinutes: 20 }),
        option('Помочь идти дальше', 'Не останавливать группу.', 'OBEY', { energyDelta: -2, careDelta: 2, advanceMinutes: 25 }),
      ],
    },
    {
      kind: 'FIELD', title: 'Потеря ориентира', situation: 'Облако закрывает гребень. Следующая вешка не видна.',
      options: [
        option('Остановиться и сверить направление', 'Использовать карту и рельеф.', 'INITIATIVE', { skill: 'NAVIGATION', skillDifficulty: 50, competenceDelta: 4, initiativeDelta: 3, advanceMinutes: 35, pace: 'CAUTIOUS' }),
        option('Держаться следов впереди', 'Сохранить темп колонны.', 'OBEY', { disciplineDelta: 2, advanceMinutes: 20 }),
        option('Идти к видимой седловине', 'Выбрать направление без согласования.', 'REFUSE', { skill: 'NAVIGATION', skillDifficulty: 62, initiativeDelta: 4, leaderTrustDelta: -5, advanceMinutes: 30, pace: 'FAST' }),
      ],
    },
  ],
  DECISION: [
    {
      kind: 'ORDER', title: 'Решение руководителя', situation: 'Группа дошла до развилки. Руководитель выбирает более прямую линию.', order: 'Связки идут по центру. Не растягиваться и не менять линию.',
      options: [
        option('Подчиниться', 'Принять общий риск и держать место.', 'OBEY', { disciplineDelta: 3, leaderTrustDelta: 2, advanceMinutes: 30, pace: 'FAST' }),
        option('Предложить обход', 'Коротко изложить свои аргументы.', 'QUESTION', { skill: 'NAVIGATION', skillDifficulty: 54, initiativeDelta: 3, competenceDelta: 2, advanceMinutes: 35, pace: 'CAUTIOUS' }),
        option('Увести свою связку в обход', 'Нарушить общий план.', 'REFUSE', { skill: 'LEADERSHIP', skillDifficulty: 65, leaderTrustDelta: -8, initiativeDelta: 4, advanceMinutes: 45, pace: 'CAUTIOUS' }),
      ],
    },
    {
      kind: 'MORAL', title: 'Цена вершины', situation: 'Слабый участник просит дать ему ещё один участок, хотя руководитель готов развернуть его.',
      options: [
        option('Поддержать разворот', 'Поставить состояние человека выше цели.', 'CARE', { careDelta: 4, leaderTrustDelta: 2, groupTrustDelta: -1, advanceMinutes: 15, pace: 'CAUTIOUS' }),
        option('Предложить сопровождение', 'Взять часть его работы на себя.', 'INITIATIVE', { energyDelta: -3, careDelta: 4, groupTrustDelta: 3, advanceMinutes: 25 }),
        option('Поддержать продолжение', 'Дать ему шанс идти дальше.', 'QUESTION', { skill: 'LEADERSHIP', skillDifficulty: 52, initiativeDelta: 2, advanceMinutes: 20, pace: 'FAST' }),
      ],
    },
    {
      kind: 'ROLE', title: 'Личный выбор', situation: 'Руководитель спрашивает твою оценку участка перед окончательным решением.',
      options: [
        option('Дать осторожную оценку', 'Назвать запас и точку отхода.', 'QUESTION', { skill: 'ROLE', skillDifficulty: 45, competenceDelta: 4, leaderTrustDelta: 3, advanceMinutes: 20, pace: 'CAUTIOUS' }),
        option('Поддержать быстрый проход', 'Считать участок рабочим.', 'INITIATIVE', { skill: 'ROLE', skillDifficulty: 54, competenceDelta: 3, initiativeDelta: 2, advanceMinutes: 15, pace: 'FAST' }),
        option('Отказаться от оценки', 'Не брать ответственность за общий выбор.', 'REFUSE', { competenceDelta: -2, leaderTrustDelta: -2, advanceMinutes: 10 }),
      ],
    },
  ],
  SUMMIT: [
    {
      kind: 'MORAL', title: 'Вершина', situation: 'Группа стоит наверху. Погода ещё держится, но обратный путь длиннее, чем хочется признавать.',
      options: [
        option('Сразу готовиться к спуску', 'Проверить связку, воду и порядок движения.', 'OBEY', { disciplineDelta: 3, competenceDelta: 2, leaderTrustDelta: 2, advanceMinutes: 20, pace: 'CAUTIOUS' }),
        option('Помочь слабому перед спуском', 'Перераспределить груз и проверить состояние.', 'CARE', { energyDelta: -2, careDelta: 5, groupTrustDelta: 4, advanceMinutes: 30 }),
        option('Задержаться ради личного результата', 'Потратить время на вершине.', 'REFUSE', { initiativeDelta: 1, leaderTrustDelta: -4, advanceMinutes: 40, pace: 'FAST' }),
      ],
    },
  ],
  DESCENT: [
    {
      kind: 'ORDER', title: 'Порядок спуска', situation: 'На спуске группа устала, расстояния между людьми растут.', order: 'Иди последним и проверяй, чтобы никто не отстал.',
      options: [
        option('Замкнуть колонну', 'Сохранить всех в поле зрения.', 'OBEY', { energyDelta: -3, careDelta: 3, disciplineDelta: 3, advanceMinutes: 40, pace: 'CAUTIOUS' }),
        option('Попросить смену через участок', 'Принять задачу с ограничением.', 'QUESTION', { skill: 'LEADERSHIP', skillDifficulty: 42, leaderTrustDelta: 1, advanceMinutes: 30 }),
        option('Остаться в середине', 'Не выполнять приказ полностью.', 'REFUSE', { leaderTrustDelta: -5, disciplineDelta: -4, advanceMinutes: 20 }),
      ],
    },
    {
      kind: 'FIELD', title: 'Снятие верёвки', situation: 'Последняя точка стоит далеко в стороне. За ней придётся вернуться по открытому участку.',
      options: [
        option('Вернуться за снаряжением', 'Не оставлять общественную верёвку.', 'OBEY', { skill: 'ROCK', skillDifficulty: 50, energyDelta: -3, competenceDelta: 3, advanceMinutes: 35 }),
        option('Предложить оставить линию', 'Сохранить время и силы группы.', 'QUESTION', { skill: 'LEADERSHIP', skillDifficulty: 45, initiativeDelta: 2, advanceMinutes: 20, pace: 'FAST' }),
        option('Снять только доступные точки', 'Самостоятельно сократить работу.', 'REFUSE', { leaderTrustDelta: -3, advanceMinutes: 15 }),
      ],
    },
    {
      kind: 'MORAL', title: 'Слабый участник', situation: 'Один человек больше не держит темп. До лагеря ещё несколько часов.',
      options: [
        option('Забрать часть груза', 'Замедлиться и довести его до лагеря.', 'CARE', { energyDelta: -4, careDelta: 5, groupTrustDelta: 4, advanceMinutes: 45, pace: 'CAUTIOUS' }),
        option('Сообщить руководителю', 'Потребовать новое распределение связок.', 'QUESTION', { leaderTrustDelta: 3, careDelta: 3, advanceMinutes: 25 }),
        option('Продолжить своим темпом', 'Не терять место в сильной части группы.', 'REFUSE', { groupTrustDelta: -5, careDelta: -4, advanceMinutes: 20, pace: 'FAST' }),
      ],
    },
    {
      kind: 'FIELD', title: 'Последний опасный участок', situation: 'До безопасного рельефа близко. Именно здесь усталость делает простые действия неточными.',
      options: [
        option('Проверять каждое действие', 'Снизить темп до полного контроля.', 'OBEY', { skill: 'ROLE', skillDifficulty: 42, competenceDelta: 3, disciplineDelta: 2, advanceMinutes: 40, pace: 'CAUTIOUS' }),
        option('Поддерживать темп группы', 'Не создавать затор.', 'QUESTION', { skill: 'ROLE', skillDifficulty: 50, competenceDelta: 2, advanceMinutes: 25 }),
        option('Спуститься быстрее остальных', 'Скорее выйти на безопасный рельеф.', 'REFUSE', { energyDelta: -2, leaderTrustDelta: -4, advanceMinutes: 20, pace: 'FAST' }),
      ],
    },
  ],
  EXIT: [
    {
      kind: 'MORAL', title: 'Возвращение', situation: 'Последний груз снят. Руководитель собирает короткий разбор ещё до дороги домой.',
      options: [
        option('Честно разобрать ошибки', 'Назвать свои сильные и слабые решения.', 'QUESTION', { competenceDelta: 3, disciplineDelta: 2, leaderTrustDelta: 2, advanceMinutes: 20 }),
        option('Отметить помощь команды', 'Сделать упор на людях, которые вытянули экспедицию.', 'CARE', { careDelta: 3, groupTrustDelta: 3, advanceMinutes: 15 }),
        option('Говорить только о результате', 'Не обсуждать внутренние проблемы группы.', 'REFUSE', { initiativeDelta: 1, leaderTrustDelta: -2, advanceMinutes: 10 }),
      ],
    },
  ],
};

function normalizedOption(optionValue: SceneOptionDraft, id: string, role: CareerState['expeditionPlan']['playerRole']): ParticipantSceneOption {
  const skill = optionValue.skill === 'ROLE' ? roleSkill[role] : optionValue.skill;
  return { ...optionValue, id, skill };
}

function routeForCareer(career: CareerState): ExpeditionRoute | null {
  const climb = career.activeClimb;
  if (!climb) return null;
  return career.routes.find(route => route.id === climb.routeId) ?? null;
}

export function createParticipantExpeditionState(route: ExpeditionRoute): ParticipantExpeditionState {
  const targetActions = route.graph?.nodes.reduce((sum, node) => sum + node.requiredActionCount, 0) ?? Math.max(18, route.segments.length * 3);
  return {
    graphNodeIndex: 0,
    nodeActionIndex: 0,
    totalActions: 0,
    targetActions,
    leaderTrust: 50,
    groupTrust: 50,
    discipline: 0,
    initiative: 0,
    care: 0,
    competence: 0,
    ordersReceived: 0,
    ordersObeyed: 0,
    ordersRefused: 0,
    rankPointsEarned: 0,
    decisions: [],
    routeComplete: false,
    evaluation: null,
  };
}

export function getCurrentParticipantNode(career: CareerState) {
  const simulation = career.activeClimb?.simulation;
  if (simulation) {
    const stages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
    const stage = stages[Math.min(simulation.stageIndex, Math.max(0, stages.length - 1))];
    if (!stage) return null;
    return {
      id: stage.id,
      phase: stage.phase,
      label: stage.label,
      segmentId: stage.sourceSegmentId,
      campPossible: stage.campPossible,
      estimatedMinutes: 0,
      requiredActionCount: Math.max(1, Math.ceil(stage.requiredProgress / 50)),
    };
  }
  const route = routeForCareer(career);
  const participant = career.activeClimb?.participant;
  if (!route?.graph || !participant) return null;
  return route.graph.nodes[Math.min(participant.graphNodeIndex, route.graph.nodes.length - 1)] ?? null;
}

export function createParticipantEvent(career: CareerState, stage: ExpeditionSimulationStage, serial: number): ParticipantScene {
  const climb = career.activeClimb!;
  const participant = climb.participant;
  const templates = phaseTemplates[stage.phase]?.length ? phaseTemplates[stage.phase] : phaseTemplates.TECHNICAL;
  const templateIndex = Math.abs(serial + stage.id.length + (participant?.totalActions ?? 0)) % templates.length;
  const template = templates[templateIndex]!;
  const leader = climb.leaderNpcId ? career.teamRoster.find(member => member.id === climb.leaderNpcId) ?? null : null;
  const options = template.options.map((item, index) => normalizedOption(item, `${stage.id}:event:${serial}:${index}`, climb.playerRole));
  return {
    id: `${stage.id}:event:${serial}`,
    kind: template.kind,
    phase: stage.phase,
    nodeId: stage.id,
    nodeLabel: stage.label,
    title: template.title,
    situation: template.situation.replace('{ROLE}', roleNames[climb.playerRole]),
    orderText: template.order ?? null,
    leaderNpcId: climb.leaderNpcId,
    leaderName: leader?.name ?? 'Руководитель экспедиции',
    roleLabel: roleNames[climb.playerRole],
    options,
  };
}

export function getCurrentParticipantScene(career: CareerState): ParticipantScene | null {
  const climb = career.activeClimb;
  if (!climb?.participant) return null;
  if (climb.simulation) return climb.simulation.activeEvent;
  const participant = climb.participant;
  const node = getCurrentParticipantNode(career);
  if (!node) return null;
  const templates = phaseTemplates[node.phase];
  const templateIndex = (participant.graphNodeIndex + participant.nodeActionIndex) % templates.length;
  const template = templates[templateIndex]!;
  const leader = climb.leaderNpcId ? career.teamRoster.find(member => member.id === climb.leaderNpcId) ?? null : null;
  const options = template.options.map((item, index) => normalizedOption(item, `${node.id}:${participant.nodeActionIndex}:${index}`, climb.playerRole));
  return {
    id: `${node.id}:scene:${participant.nodeActionIndex}`,
    kind: template.kind,
    phase: node.phase,
    nodeId: node.id,
    nodeLabel: node.label,
    title: template.title,
    situation: template.situation.replace('{ROLE}', roleNames[climb.playerRole]),
    orderText: template.order ?? null,
    leaderNpcId: climb.leaderNpcId,
    leaderName: leader?.name ?? 'Руководитель экспедиции',
    roleLabel: roleNames[climb.playerRole],
    options,
  };
}

export function leaderPace(career: CareerState, fallback: ClimbPace = 'STEADY'): ClimbPace {
  const climb = career.activeClimb;
  const leader = climb?.leaderNpcId ? career.teamRoster.find(member => member.id === climb.leaderNpcId) : null;
  if (!leader) return fallback;
  const participant = climb?.participant;
  if (participant && participant.leaderTrust >= 60 && fallback === 'CAUTIOUS') return 'CAUTIOUS';
  if (leader.personality.caution >= leader.personality.ambition + 12) return 'CAUTIOUS';
  if (leader.personality.ambition >= leader.personality.caution + 14) return 'FAST';
  return fallback;
}

export function resolveParticipantSkill(career: CareerState, optionValue: ParticipantSceneOption) {
  if (!optionValue.skill || optionValue.skillDifficulty === undefined) return { success: true, margin: 0 };
  const climb = career.activeClimb!;
  const skill = career.hero.skills[optionValue.skill];
  const rng = createRng(`${career.rootSeed}:${climb.id}:participant:${climb.participant?.totalActions ?? 0}:${optionValue.id}`);
  const roll = skill * 10 + career.hero.form * .18 + rng.int(0, 28);
  return { success: roll >= optionValue.skillDifficulty, margin: Math.round(roll - optionValue.skillDifficulty) };
}

export function evaluateParticipant(state: ParticipantExpeditionState, successful: boolean, casualties: number): ParticipantEvaluation {
  const obedienceRate = state.ordersReceived ? state.ordersObeyed / state.ordersReceived : 1;
  const raw = 42
    + state.competence * 2.1
    + state.care * 1.35
    + state.initiative * 1.15
    + state.discipline * 1.2
    + (state.leaderTrust - 50) * .55
    + (state.groupTrust - 50) * .45
    + obedienceRate * 8
    + (successful ? 8 : 0)
    - state.ordersRefused * 4
    - casualties * 12;
  const score = clamp(Math.round(raw));
  const grade: ParticipantEvaluation['grade'] = score >= 88 ? 'A' : score >= 73 ? 'B' : score >= 58 ? 'C' : score >= 42 ? 'D' : 'E';
  const tags = [
    state.competence >= 8 ? 'Надёжен в своей роли' : '',
    state.care >= 8 ? 'Берегёт людей' : '',
    state.initiative >= 8 ? 'Берёт инициативу' : '',
    state.discipline >= 8 ? 'Держит приказ' : '',
    state.ordersRefused >= 2 ? 'Часто спорит с руководителем' : '',
    state.leaderTrust < 40 ? 'Потерял доверие руководителя' : '',
  ].filter(Boolean);
  const rankPoints = Math.max(1, Math.round(score / 16) + (successful ? 2 : 0));
  const title = grade === 'A' ? 'Ключевой участник' : grade === 'B' ? 'Надёжная работа' : grade === 'C' ? 'Рабочая экспедиция' : grade === 'D' ? 'Много ошибок' : 'Доверие потеряно';
  const summary = `${state.totalActions} личных решений. Приказы: ${state.ordersObeyed}/${state.ordersReceived} выполнено. Доверие руководителя: ${state.leaderTrust}.`;
  return { grade, title, score, rankPoints, summary, tags };
}

export function nodeProgress(career: CareerState) {
  const simulation = career.activeClimb?.simulation;
  if (simulation) {
    const stages = simulation.direction === 'ASCENT' ? simulation.ascentStages : simulation.descentStages;
    const stage = stages[simulation.stageIndex];
    if (!stage) return { current: 0, required: 0, overall: simulation.status === 'SAFE' ? 100 : 0 };
    return {
      current: Math.floor(stage.progress),
      required: Math.floor(stage.requiredProgress),
      overall: Math.min(100, Math.round((simulation.stageIndex + stage.progress / Math.max(1, stage.requiredProgress)) / Math.max(1, stages.length) * 100)),
    };
  }
  const participant = career.activeClimb?.participant;
  const node = getCurrentParticipantNode(career);
  if (!participant || !node) return { current: 0, required: 0, overall: 0 };
  return {
    current: participant.nodeActionIndex,
    required: node.requiredActionCount,
    overall: Math.min(100, Math.round(participant.totalActions / Math.max(1, participant.targetActions) * 100)),
  };
}

export function participantLeader(career: CareerState): TeamMember | null {
  const leaderId = career.activeClimb?.leaderNpcId;
  return leaderId ? career.teamRoster.find(member => member.id === leaderId) ?? null : null;
}
