/**
 * 📎 规格正本：docs/Topic-Library-v1.0.md（话题库 85 题正文 + 附录数据 Schema）
 * 📍 集中索引：docs/README.md → 规格③话题库落地映射
 *
 * 表达研究所 · 静态题库（对齐《表达研究所-话题库》正式稿）
 * 规模：A随便聊聊 40 题 + C演讲 20 题 + D面试 25 题 = 共 85 题
 * B自言自语：无题，只有引导语 B_HINT
 *
 * 字段双写策略（零破坏升级）：
 *   【附录 Schema（作品展示）】mode / category / difficulty_str / content / guidance / time_limit / suggested_duration
 *   【兼容旧上层（运行期）】scene / title / hint / suggested_minutes / difficulty(数字 1-3)
 *
 * 两个对外导出函数保持不变：pickRandomTopic(scene, excludeId) / getTopicById(scene, id)
 */
const TOPIC_LIBRARY = {
  A: [
    // ===== 随便聊聊（A）· 日常观察 8 题 =====
    {
      id: 'A001', scene: 'A', title: '今天有没有一个瞬间，让你觉得心情突然变好了？',
      hint: '可以说说当时在哪里、发生了什么，以及那个瞬间为什么特别。',
      difficulty: 1,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '今天有没有一个瞬间，让你觉得心情突然变好了？',
      guidance: '可以说说当时在哪里、发生了什么，以及那个瞬间为什么特别。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A002', scene: 'A', title: '最近你发现身边有什么小变化？',
      hint: '可以留意天气、街道、同事同学，或自己的生活习惯。',
      difficulty: 1,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '最近你发现身边有什么小变化？',
      guidance: '可以留意天气、街道、同事同学，或自己的生活习惯。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A003', scene: 'A', title: '今天最忙的那一阵，你都在做什么？',
      hint: '按事情发生的顺序，聊聊最忙的是哪几件事。',
      difficulty: 1,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '今天最忙的那一阵，你都在做什么？',
      guidance: '按事情发生的顺序，聊聊最忙的是哪几件事。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A004', scene: 'A', title: '最近吃到的哪样东西让你印象很深？',
      hint: '可以聊味道、地点，以及当时和谁一起吃。',
      difficulty: 1,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '最近吃到的哪样东西让你印象很深？',
      guidance: '可以聊味道、地点，以及当时和谁一起吃。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A005', scene: 'A', title: '一天里，你最喜欢哪个固定时刻？',
      hint: '说说那个时候你通常在做什么。',
      difficulty: 1,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '一天里，你最喜欢哪个固定时刻？',
      guidance: '说说那个时候你通常在做什么。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A006', scene: 'A', title: '最近一次排队时，你注意到了什么？',
      hint: '可以描述周围的人、环境，或一件有趣的小插曲。',
      difficulty: 2,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '最近一次排队时，你注意到了什么？',
      guidance: '可以描述周围的人、环境，或一件有趣的小插曲。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A007', scene: 'A', title: '你的桌面或房间里，哪件东西最常被你拿起来用？',
      hint: '介绍它的样子、用途，以及你通常什么时候会用到。',
      difficulty: 2,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '你的桌面或房间里，哪件东西最常被你拿起来用？',
      guidance: '介绍它的样子、用途，以及你通常什么时候会用到。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A008', scene: 'A', title: '最近有什么声音让你一下子留意到了？',
      hint: '聊聊它在哪里出现、听起来怎样，以及让你想到了什么。',
      difficulty: 2,
      mode: 'free_talk', category: '日常观察', difficulty_str: 'basic',
      content: '最近有什么声音让你一下子留意到了？',
      guidance: '聊聊它在哪里出现、听起来怎样，以及让你想到了什么。',
      time_limit: null, suggested_duration: '1min'
    },

    // ===== 随便聊聊（A）· 观点表达 8 题 =====
    {
      id: 'A009', scene: 'A', title: '最近一次临时改变周末计划，是因为什么？',
      hint: '聊聊原本想做什么，后来又去了哪里或做了什么。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近一次临时改变周末计划，是因为什么？',
      guidance: '聊聊原本想做什么，后来又去了哪里或做了什么。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A010', scene: 'A', title: '最近刷到的哪条短视频，让你忍不住看完了？',
      hint: '可以说说视频讲了什么，哪个细节吸引了你。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近刷到的哪条短视频，让你忍不住看完了？',
      guidance: '可以说说视频讲了什么，哪个细节吸引了你。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A011', scene: 'A', title: '最近一次和朋友聊了很久，你们在聊什么？',
      hint: '回忆一下聊天是怎么开始的，后来聊到了哪里。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近一次和朋友聊了很久，你们在聊什么？',
      guidance: '回忆一下聊天是怎么开始的，后来聊到了哪里。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A012', scene: 'A', title: '你最近单曲循环过哪首歌？',
      hint: '可以聊第一次听到它的场景，或你最喜欢的一句歌词。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '你最近单曲循环过哪首歌？',
      guidance: '可以聊第一次听到它的场景，或你最喜欢的一句歌词。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A013', scene: 'A', title: '最近哪条手机通知让你特别在意？',
      hint: '说说它来自谁、是什么内容，以及你看到时的反应。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近哪条手机通知让你特别在意？',
      guidance: '说说它来自谁、是什么内容，以及你看到时的反应。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A014', scene: 'A', title: '最近一次面对面聊天，哪个细节让你记住了？',
      hint: '可以聊对方的表情、语气，或当时发生的小插曲。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近一次面对面聊天，哪个细节让你记住了？',
      guidance: '可以聊对方的表情、语气，或当时发生的小插曲。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A015', scene: 'A', title: '刚到一个新环境时，你最先观察的通常是什么？',
      hint: '结合最近一次入学、入职或参加活动的经历来聊。',
      difficulty: 3,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '刚到一个新环境时，你最先观察的通常是什么？',
      guidance: '结合最近一次入学、入职或参加活动的经历来聊。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A016', scene: 'A', title: '最近一次用 AI 帮你省时间，是在做什么？',
      hint: '说说你给了它什么任务，结果有没有帮上忙。',
      difficulty: 2,
      mode: 'free_talk', category: '观点表达', difficulty_str: 'basic',
      content: '最近一次用 AI 帮你省时间，是在做什么？',
      guidance: '说说你给了它什么任务，结果有没有帮上忙。',
      time_limit: null, suggested_duration: '1min'
    },

    // ===== 随便聊聊（A）· 个人故事 8 题 =====
    {
      id: 'A017', scene: 'A', title: '讲一次你第一次尝试某件事的经历。',
      hint: '可以聊尝试前的期待、过程中发生的事和最后的感受。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '讲一次你第一次尝试某件事的经历。',
      guidance: '可以聊尝试前的期待、过程中发生的事和最后的感受。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A018', scene: 'A', title: '回忆一次你迷路或走错路的经历。',
      hint: '从什么时候发现走错了、后来怎么找到路开始聊。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '回忆一次你迷路或走错路的经历。',
      guidance: '从什么时候发现走错了、后来怎么找到路开始聊。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A019', scene: 'A', title: '你收到过的哪件礼物，到现在还记得？',
      hint: '说说礼物是什么、谁送的，以及当时的场景。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '你收到过的哪件礼物，到现在还记得？',
      guidance: '说说礼物是什么、谁送的，以及当时的场景。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A020', scene: 'A', title: '分享一次计划被临时打乱的经历。',
      hint: '聊聊原计划、意外变化，以及后来发生了什么。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '分享一次计划被临时打乱的经历。',
      guidance: '聊聊原计划、意外变化，以及后来发生了什么。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A021', scene: 'A', title: '最近一次别人顺手帮了你什么忙？',
      hint: '描述当时的场景、对方做了什么，以及你的感受。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '最近一次别人顺手帮了你什么忙？',
      guidance: '描述当时的场景、对方做了什么，以及你的感受。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A022', scene: 'A', title: '哪一场比赛或活动的现场让你印象很深？',
      hint: '可以聊现场气氛、一个细节，或结果揭晓的瞬间。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '哪一场比赛或活动的现场让你印象很深？',
      guidance: '可以聊现场气氛、一个细节，或结果揭晓的瞬间。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A023', scene: 'A', title: '讲一次你本来很紧张，最后还是完成了的经历。',
      hint: '说说当时在做什么，你是怎么让自己继续下去的。',
      difficulty: 3,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '讲一次你本来很紧张，最后还是完成了的经历。',
      guidance: '说说当时在做什么，你是怎么让自己继续下去的。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A024', scene: 'A', title: '你和朋友最近一次小误会，是怎么解开的？',
      hint: '聊聊误会怎么发生、后来谁先开口，以及你们说了什么。',
      difficulty: 2,
      mode: 'free_talk', category: '个人故事', difficulty_str: 'basic',
      content: '你和朋友最近一次小误会，是怎么解开的？',
      guidance: '聊聊误会怎么发生、后来谁先开口，以及你们说了什么。',
      time_limit: null, suggested_duration: '1min'
    },

    // ===== 随便聊聊（A）· 想象假设 8 题 =====
    {
      id: 'A025', scene: 'A', title: '如果今天突然多出一个小时，你最想拿来做什么？',
      hint: '描述你会去哪里、和谁一起，或具体做哪件事。',
      difficulty: 2,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果今天突然多出一个小时，你最想拿来做什么？',
      guidance: '描述你会去哪里、和谁一起，或具体做哪件事。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A026', scene: 'A', title: '如果能去一座城市住一个月，你第一反应会选哪里？',
      hint: '聊聊你想住的街区、想体验的生活，或最期待的一顿饭。',
      difficulty: 3,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果能去一座城市住一个月，你第一反应会选哪里？',
      guidance: '聊聊你想住的街区、想体验的生活，或最期待的一顿饭。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A027', scene: 'A', title: '如果一种动物能回答你一个问题，你会问什么？',
      hint: '选一种动物，想象它会怎么回答你。',
      difficulty: 3,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果一种动物能回答你一个问题，你会问什么？',
      guidance: '选一种动物，想象它会怎么回答你。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A028', scene: 'A', title: '如果明天一天不能用手机，你准备怎么过？',
      hint: '从起床后第一件事开始，想象这一天的安排。',
      difficulty: 2,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果明天一天不能用手机，你准备怎么过？',
      guidance: '从起床后第一件事开始，想象这一天的安排。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A029', scene: 'A', title: '如果能给自己增加一个专属节日，你会怎么过？',
      hint: '说说节日在几月几日、会邀请谁、安排什么活动。',
      difficulty: 2,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果能给自己增加一个专属节日，你会怎么过？',
      guidance: '说说节日在几月几日、会邀请谁、安排什么活动。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A030', scene: 'A', title: '如果睡一觉就能学会一项技能，你最想选什么？',
      hint: '聊聊学会后的第一天，你会拿它做什么。',
      difficulty: 2,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果睡一觉就能学会一项技能，你最想选什么？',
      guidance: '聊聊学会后的第一天，你会拿它做什么。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A031', scene: 'A', title: '如果今天可以和学校或公司里的一位负责人互换身份，你先体验什么？',
      hint: '选一个具体场景，想象你会遇到哪些人和事。',
      difficulty: 3,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果今天可以和学校或公司里的一位负责人互换身份，你先体验什么？',
      guidance: '选一个具体场景，想象你会遇到哪些人和事。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A032', scene: 'A', title: '如果能给五年前的自己发一条语音，你最想说哪句话？',
      hint: '可以先说那句话，再聊聊为什么偏偏想告诉当时的自己。',
      difficulty: 3,
      mode: 'free_talk', category: '想象假设', difficulty_str: 'basic',
      content: '如果能给五年前的自己发一条语音，你最想说哪句话？',
      guidance: '可以先说那句话，再聊聊为什么偏偏想告诉当时的自己。',
      time_limit: null, suggested_duration: '1min'
    },

    // ===== 随便聊聊（A）· 职场·校园 8 题 =====
    {
      id: 'A033', scene: 'A', title: '最近一次小组合作里，你负责了什么？',
      hint: '说说你们怎么分工，中间发生过什么小插曲。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '最近一次小组合作里，你负责了什么？',
      guidance: '说说你们怎么分工，中间发生过什么小插曲。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A034', scene: 'A', title: '最近遇到一项没看懂的任务时，你第一步做了什么？',
      hint: '回忆一下你查了什么、问了谁，后来有没有弄明白。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '最近遇到一项没看懂的任务时，你第一步做了什么？',
      guidance: '回忆一下你查了什么、问了谁，后来有没有弄明白。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A035', scene: 'A', title: '你最近用过哪个方法，让自己没忘记一件重要的事？',
      hint: '可以聊备忘录、日历、便利贴，或你自己的小习惯。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '你最近用过哪个方法，让自己没忘记一件重要的事？',
      guidance: '可以聊备忘录、日历、便利贴，或你自己的小习惯。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A036', scene: 'A', title: '最近一次讨论出现分歧，最后是怎么继续下去的？',
      hint: '说说大家在争什么，后来谁提出了什么办法。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '最近一次讨论出现分歧，最后是怎么继续下去的？',
      guidance: '说说大家在争什么，后来谁提出了什么办法。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A037', scene: 'A', title: '最近哪件事是你一个人完成的，哪件事是和别人一起完成的？',
      hint: '各选一件具体的事，聊聊过程有什么不同。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '最近哪件事是你一个人完成的，哪件事是和别人一起完成的？',
      guidance: '各选一件具体的事，聊聊过程有什么不同。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A038', scene: 'A', title: '你最近听过的一次汇报里，记住了什么？',
      hint: '可以是一句话、一页内容，或汇报人的一个表达方式。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '你最近听过的一次汇报里，记住了什么？',
      guidance: '可以是一句话、一页内容，或汇报人的一个表达方式。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A039', scene: 'A', title: '最近一次不想开始学习或工作时，你后来怎么动起来的？',
      hint: '聊聊当时是什么任务，你做的第一个小动作是什么。',
      difficulty: 2,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '最近一次不想开始学习或工作时，你后来怎么动起来的？',
      guidance: '聊聊当时是什么任务，你做的第一个小动作是什么。',
      time_limit: null, suggested_duration: '1min'
    },
    {
      id: 'A040', scene: 'A', title: '实习、社团或第一份工作里，哪件小事和你原先想得不一样？',
      hint: '描述原来的想象、实际发生的事，以及你的感受。',
      difficulty: 3,
      mode: 'free_talk', category: '职场·校园', difficulty_str: 'basic',
      content: '实习、社团或第一份工作里，哪件小事和你原先想得不一样？',
      guidance: '描述原来的想象、实际发生的事，以及你的感受。',
      time_limit: null, suggested_duration: '1min'
    },
  ],

  B: [], // 自言自语：无题，只有进入后提示

  // ===== C 演讲场景（共 20 题：初级10 + 进阶10）=====
  C: [
    // 初级 10 题
    {
      id: 'C001', scene: 'C', title: '便利与归属感：城市生活让我们得到了什么，又失去了什么？',
      hint: '可从公共服务与机会、邻里关系与社区认同、个人生活成本三个维度切入。',
      suggested_minutes: 4, difficulty: 2,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '便利与归属感：城市生活让我们得到了什么，又失去了什么？',
      guidance: '可从公共服务与机会、邻里关系与社区认同、个人生活成本三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C002', scene: 'C', title: '为什么越来越多的年轻人选择"慢就业"？',
      hint: '可从就业市场、职业期待、家庭支持与个人风险三个维度切入。',
      suggested_minutes: 4, difficulty: 2,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '为什么越来越多的年轻人选择"慢就业"？',
      guidance: '可从就业市场、职业期待、家庭支持与个人风险三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C003', scene: 'C', title: '短视频正在丰富我们的知识，还是削弱深度思考？',
      hint: '可从信息获取效率、注意力结构、知识理解与迁移三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '短视频正在丰富我们的知识，还是削弱深度思考？',
      guidance: '可从信息获取效率、注意力结构、知识理解与迁移三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C004', scene: 'C', title: '大学教育应该更重视通识素养，还是就业技能？',
      hint: '可从个人长期发展、企业人才需求、教育资源配置三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '大学教育应该更重视通识素养，还是就业技能？',
      guidance: '可从个人长期发展、企业人才需求、教育资源配置三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C005', scene: 'C', title: '"情绪价值"为什么成为年轻人消费的重要理由？',
      hint: '可从消费心理、社交表达、品牌商业化三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '"情绪价值"为什么成为年轻人消费的重要理由？',
      guidance: '可从消费心理、社交表达、品牌商业化三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C006', scene: 'C', title: '远程办公会带来自由，还是让工作边界更模糊？',
      hint: '可从个人效率、团队协作、劳动权益与管理方式三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '远程办公会带来自由，还是让工作边界更模糊？',
      guidance: '可从个人效率、团队协作、劳动权益与管理方式三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C007', scene: 'C', title: '算法推荐让选择更轻松，也让选择更单一吗？',
      hint: '可从用户便利、信息茧房、平台责任三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '算法推荐让选择更轻松，也让选择更单一吗？',
      guidance: '可从用户便利、信息茧房、平台责任三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C008', scene: 'C', title: '公共空间对一座城市为什么重要？',
      hint: '可从社会交往、城市公平、文化记忆与商业开发三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '公共空间对一座城市为什么重要？',
      guidance: '可从社会交往、城市公平、文化记忆与商业开发三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C009', scene: 'C', title: '当"性价比"成为主流，品牌还需要讲故事吗？',
      hint: '可从消费信心、产品价值、品牌认同三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '当"性价比"成为主流，品牌还需要讲故事吗？',
      guidance: '可从消费信心、产品价值、品牌认同三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C010', scene: 'C', title: '个人成长是否一定要离开舒适区？',
      hint: '可从挑战的收益、盲目冒险的成本、成长节奏与安全感三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '初级', difficulty_str: 'basic',
      content: '个人成长是否一定要离开舒适区？',
      guidance: '可从挑战的收益、盲目冒险的成本、成长节奏与安全感三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },

    // 进阶 10 题
    {
      id: 'C011', scene: 'C', title: '效率工具越多，我们就一定越高效吗？',
      hint: '可从工具收益、切换与学习成本、组织流程三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '效率工具越多，我们就一定越高效吗？',
      guidance: '可从工具收益、切换与学习成本、组织流程三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C012', scene: 'C', title: '职业选择中，"热爱"和"擅长"谁更值得优先？',
      hint: '可从短期生存、长期动力、能力可塑性与机会成本三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '职业选择中，"热爱"和"擅长"谁更值得优先？',
      guidance: '可从短期生存、长期动力、能力可塑性与机会成本三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C013', scene: 'C', title: '社交媒体扩大了连接，也稀释了关系吗？',
      hint: '可从连接范围、交流深度、自我呈现与平台机制三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '社交媒体扩大了连接，也稀释了关系吗？',
      guidance: '可从连接范围、交流深度、自我呈现与平台机制三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C014', scene: 'C', title: '我们是否过度强调了失败对成长的价值？',
      hint: '可从失败成本、复盘条件、幸存者偏差三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '我们是否过度强调了失败对成长的价值？',
      guidance: '可从失败成本、复盘条件、幸存者偏差三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C015', scene: 'C', title: '团队管理中，过程透明和结果负责哪个更重要？',
      hint: '可从协作信任、管理成本、任务类型与责任边界三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '团队管理中，过程透明和结果负责哪个更重要？',
      guidance: '可从协作信任、管理成本、任务类型与责任边界三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C016', scene: 'C', title: 'AI 普及后，人的核心竞争力会如何变化？',
      hint: '可从问题定义、判断与审美、沟通协作与伦理责任三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: 'AI 普及后，人的核心竞争力会如何变化？',
      guidance: '可从问题定义、判断与审美、沟通协作与伦理责任三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C017', scene: 'C', title: '"稳定"应该成为年轻人职业选择的首要标准吗？',
      hint: '可从经济周期、个人阶段、风险承受力与成长空间三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '"稳定"应该成为年轻人职业选择的首要标准吗？',
      guidance: '可从经济周期、个人阶段、风险承受力与成长空间三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C018', scene: 'C', title: '信息越丰富，为什么人反而更难做决定？',
      hint: '可从筛选成本、选择过载、判断标准与平台影响三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '信息越丰富，为什么人反而更难做决定？',
      guidance: '可从筛选成本、选择过载、判断标准与平台影响三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C019', scene: 'C', title: '表达能力会放大真实能力，还是掩盖能力差距？',
      hint: '可从机会分配、协作效率、评价偏差与长期结果三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '表达能力会放大真实能力，还是掩盖能力差距？',
      guidance: '可从机会分配、协作效率、评价偏差与长期结果三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
    {
      id: 'C020', scene: 'C', title: '真正有效的自律，依靠意志力还是环境设计？',
      hint: '可从行为习惯、制度与环境、个体差异和长期可持续性三个维度切入。',
      suggested_minutes: 4, difficulty: 3,
      mode: 'speech', category: '进阶', difficulty_str: 'advanced',
      content: '真正有效的自律，依靠意志力还是环境设计？',
      guidance: '可从行为习惯、制度与环境、个体差异和长期可持续性三个维度切入。',
      time_limit: 240, suggested_duration: '3-5min'
    },
  ],

  // ===== D 面试场景（共 25 题：四组）=====
  D: [
    // 第一组：自我介绍与背景（5 题）
    {
      id: 'D001', scene: 'D', title: '请用 1—2 分钟做一个自我介绍。',
      hint: '围绕与岗位相关的经历、能力和求职动机展开，避免重复简历全部内容。',
      suggested_minutes: 2, difficulty: 2,
      mode: 'interview', category: '自我介绍与背景', difficulty_str: 'basic',
      content: '请用 1—2 分钟做一个自我介绍。',
      guidance: '围绕与岗位相关的经历、能力和求职动机展开，避免重复简历全部内容。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D002', scene: 'D', title: '请介绍一段与你应聘岗位最相关的经历。',
      hint: '说明你的职责、关键行动和结果，并点明它与目标岗位的联系。',
      suggested_minutes: 2, difficulty: 2,
      mode: 'interview', category: '自我介绍与背景', difficulty_str: 'basic',
      content: '请介绍一段与你应聘岗位最相关的经历。',
      guidance: '说明你的职责、关键行动和结果，并点明它与目标岗位的联系。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D003', scene: 'D', title: '请介绍一个你投入最多的项目。',
      hint: '交代项目目标、个人贡献、难点和最终成果，突出你真正负责的部分。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '自我介绍与背景', difficulty_str: 'basic',
      content: '请介绍一个你投入最多的项目。',
      guidance: '交代项目目标、个人贡献、难点和最终成果，突出你真正负责的部分。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D004', scene: 'D', title: '你为什么选择产品、运营或市场方向？',
      hint: '结合一次具体经历说明兴趣来源，再说明你的能力匹配和长期计划。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '自我介绍与背景', difficulty_str: 'basic',
      content: '你为什么选择产品、运营或市场方向？',
      guidance: '结合一次具体经历说明兴趣来源，再说明你的能力匹配和长期计划。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D005', scene: 'D', title: '你的哪些特点适合这个岗位？',
      hint: '选择 2—3 个与岗位要求直接相关的特点，每个特点配一个证据。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '自我介绍与背景', difficulty_str: 'basic',
      content: '你的哪些特点适合这个岗位？',
      guidance: '选择 2—3 个与岗位要求直接相关的特点，每个特点配一个证据。',
      time_limit: 120, suggested_duration: '1-2min'
    },

    // 第二组：行为面试题 STAR 类（8 题）
    {
      id: 'D006', scene: 'D', title: '请描述一次你在时间紧、任务重的情况下完成工作的经历。',
      hint: '按情境、任务、行动、结果展开，重点说明如何确定优先级和控制风险。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请描述一次你在时间紧、任务重的情况下完成工作的经历。',
      guidance: '按情境、任务、行动、结果展开，重点说明如何确定优先级和控制风险。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D007', scene: 'D', title: '请讲一次你与团队成员意见不一致的经历。',
      hint: '说明分歧原因、你如何倾听和验证，以及最终怎样形成可执行方案。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请讲一次你与团队成员意见不一致的经历。',
      guidance: '说明分歧原因、你如何倾听和验证，以及最终怎样形成可执行方案。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D008', scene: 'D', title: '举一个你主动发现问题并推动解决的例子。',
      hint: '说明问题如何被发现、为什么值得解决，以及你推动了哪些关键动作。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '举一个你主动发现问题并推动解决的例子。',
      guidance: '说明问题如何被发现、为什么值得解决，以及你推动了哪些关键动作。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D009', scene: 'D', title: '请描述一次你没有达到预期目标的经历。',
      hint: '坦诚说明结果与原因，重点回答你如何复盘以及之后改变了什么。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请描述一次你没有达到预期目标的经历。',
      guidance: '坦诚说明结果与原因，重点回答你如何复盘以及之后改变了什么。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D010', scene: 'D', title: '请讲一次你快速学习新知识并用于实际任务的经历。',
      hint: '说明学习目标、方法、应用场景和可验证的效果。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请讲一次你快速学习新知识并用于实际任务的经历。',
      guidance: '说明学习目标、方法、应用场景和可验证的效果。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D011', scene: 'D', title: '请描述一次你说服他人接受你的建议的经历。',
      hint: '说明对方的顾虑、你使用的事实或沟通方式，以及最终结果。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请描述一次你说服他人接受你的建议的经历。',
      guidance: '说明对方的顾虑、你使用的事实或沟通方式，以及最终结果。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D012', scene: 'D', title: '请讲一次你承担了职责范围之外工作的经历。',
      hint: '解释为什么主动承担、如何平衡本职任务，以及对团队产生的影响。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请讲一次你承担了职责范围之外工作的经历。',
      guidance: '解释为什么主动承担、如何平衡本职任务，以及对团队产生的影响。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D013', scene: 'D', title: '请描述一次你根据反馈调整方案的经历。',
      hint: '交代原方案、收到的关键反馈、调整逻辑和调整后的结果。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '行为面试 STAR', difficulty_str: 'basic',
      content: '请描述一次你根据反馈调整方案的经历。',
      guidance: '交代原方案、收到的关键反馈、调整逻辑和调整后的结果。',
      time_limit: 180, suggested_duration: '2-3min'
    },

    // 第三组：观点与判断题（7 题）
    {
      id: 'D014', scene: 'D', title: '你认为应届生进入职场后，最重要的能力是什么？',
      hint: '先给出明确判断，再结合岗位特点和个人经历说明理由。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '你认为应届生进入职场后，最重要的能力是什么？',
      guidance: '先给出明确判断，再结合岗位特点和个人经历说明理由。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D015', scene: 'D', title: '你怎么看待"用户说想要的，不一定是用户真正需要的"？',
      hint: '区分用户表达、使用场景和底层需求，并举例说明如何验证。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '你怎么看待"用户说想要的，不一定是用户真正需要的"？',
      guidance: '区分用户表达、使用场景和底层需求，并举例说明如何验证。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D016', scene: 'D', title: '如果速度和质量发生冲突，你会如何选择？',
      hint: '不要只选一边，可根据任务目标、风险和截止时间给出判断标准。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '如果速度和质量发生冲突，你会如何选择？',
      guidance: '不要只选一边，可根据任务目标、风险和截止时间给出判断标准。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D017', scene: 'D', title: '你认为数据和直觉在决策中分别扮演什么角色？',
      hint: '说明两者各自适用的场景，以及出现冲突时如何进一步验证。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '你认为数据和直觉在决策中分别扮演什么角色？',
      guidance: '说明两者各自适用的场景，以及出现冲突时如何进一步验证。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D018', scene: 'D', title: '如果你不同意上级或项目负责人的方案，你会怎么做？',
      hint: '先理解目标与约束，再用事实表达分歧，并提供替代方案或验证办法。',
      suggested_minutes: 3, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '如果你不同意上级或项目负责人的方案，你会怎么做？',
      guidance: '先理解目标与约束，再用事实表达分歧，并提供替代方案或验证办法。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D019', scene: 'D', title: '你怎么看待工作中的重复性任务？',
      hint: '可以谈基础价值、效率优化和自动化机会，避免简单否定。',
      suggested_minutes: 2, difficulty: 2,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '你怎么看待工作中的重复性任务？',
      guidance: '可以谈基础价值、效率优化和自动化机会，避免简单否定。',
      time_limit: 120, suggested_duration: '1-2min'
    },
    {
      id: 'D020', scene: 'D', title: '你认为一个优秀团队最重要的特征是什么？',
      hint: '选择一个核心特征，从协作机制、实际表现和结果三个层面解释。',
      suggested_minutes: 2, difficulty: 3,
      mode: 'interview', category: '观点与判断', difficulty_str: 'basic',
      content: '你认为一个优秀团队最重要的特征是什么？',
      guidance: '选择一个核心特征，从协作机制、实际表现和结果三个层面解释。',
      time_limit: 120, suggested_duration: '1-2min'
    },

    // 第四组：产品 / 运营方向题（5 题）
    {
      id: 'D021', scene: 'D', title: '某款校园 App 的日活连续两周下降，你会如何分析？',
      hint: '先确认口径和异常范围，再从用户、渠道、产品版本、季节性和竞品等方向拆解，并提出验证顺序。',
      suggested_minutes: 3, difficulty: 4,
      mode: 'interview', category: '产品/运营方向', difficulty_str: 'advanced',
      content: '某款校园 App 的日活连续两周下降，你会如何分析？',
      guidance: '先确认口径和异常范围，再从用户、渠道、产品版本、季节性和竞品等方向拆解，并提出验证顺序。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D022', scene: 'D', title: '用户提出一个强烈需求，但只有少数人反馈，你会如何判断是否要做？',
      hint: '分析用户类型、场景频率、价值与成本，并通过访谈、行为数据或小规模实验验证。',
      suggested_minutes: 3, difficulty: 4,
      mode: 'interview', category: '产品/运营方向', difficulty_str: 'advanced',
      content: '用户提出一个强烈需求，但只有少数人反馈，你会如何判断是否要做？',
      guidance: '分析用户类型、场景频率、价值与成本，并通过访谈、行为数据或小规模实验验证。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D023', scene: 'D', title: '如果让你为一款表达练习产品设计新手引导，你会怎么做？',
      hint: '明确新用户首次成功的关键动作，再设计最短路径、反馈机制和衡量指标。',
      suggested_minutes: 3, difficulty: 4,
      mode: 'interview', category: '产品/运营方向', difficulty_str: 'advanced',
      content: '如果让你为一款表达练习产品设计新手引导，你会怎么做？',
      guidance: '明确新用户首次成功的关键动作，再设计最短路径、反馈机制和衡量指标。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D024', scene: 'D', title: '一次内容活动曝光很高，但参与率很低，你会如何优化？',
      hint: '沿曝光—理解—兴趣—行动漏斗定位问题，并分别检查人群、内容、门槛和激励。',
      suggested_minutes: 3, difficulty: 4,
      mode: 'interview', category: '产品/运营方向', difficulty_str: 'advanced',
      content: '一次内容活动曝光很高，但参与率很低，你会如何优化？',
      guidance: '沿曝光—理解—兴趣—行动漏斗定位问题，并分别检查人群、内容、门槛和激励。',
      time_limit: 180, suggested_duration: '2-3min'
    },
    {
      id: 'D025', scene: 'D', title: '请设计一次用户调研，了解大学生使用 AI 学习工具的需求。',
      hint: '说明研究目标、样本选择、访谈或问卷提纲，以及如何把结论转化为产品决策。',
      suggested_minutes: 3, difficulty: 4,
      mode: 'interview', category: '产品/运营方向', difficulty_str: 'advanced',
      content: '请设计一次用户调研，了解大学生使用 AI 学习工具的需求。',
      guidance: '说明研究目标、样本选择、访谈或问卷提纲，以及如何把结论转化为产品决策。',
      time_limit: 180, suggested_duration: '2-3min'
    },
  ],

  // 自言自语的提示语
  B_HINT: {
    title: '想说什么都可以',
    hint: '这里没有题目、没有评判。随便聊：今天的天气、刚才路过的一条狗、你一直想问自己的一个问题、最近做的一个梦……声音只是陪你整理思绪。',
  },
};

/**
 * 工具：随机抽取一个题目
 * @param {'A'|'B'|'C'|'D'} scene
 * @param {string} [excludeId] 可选，排除某个 id（换题时避免抽到同一道）
 */
function pickRandomTopic(scene, excludeId) {
  const pool = TOPIC_LIBRARY[scene] || [];
  if (!pool.length) return null;
  let item;
  if (excludeId && pool.length > 1) {
    const candidates = pool.filter(t => t.id !== excludeId);
    item = candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    item = pool[Math.floor(Math.random() * pool.length)];
  }
  return item ? { ...item } : null;
}

function getTopicById(scene, id) {
  const pool = TOPIC_LIBRARY[scene] || [];
  const item = pool.find(t => t.id === id);
  return item ? { ...item } : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOPIC_LIBRARY, pickRandomTopic, getTopicById };
}
