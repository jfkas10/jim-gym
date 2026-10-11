"use strict";

const C={
  gearRatio:3.43,crankLengthMeters:.170,referenceCrr:.006,referencePressure:40,
  minCrr:.004,maxCrr:.012,airDensity:1.225,standingCdA:.85,g:9.80665,
  drivetrainEfficiency:.95,standingGrossEfficiency:.205,stoppedMET:1.3,
  milesToMeters:1609.344,feetToMeters:.3048,poundsToKg:.45359237,
  inchesToMeters:.0254,mpsToMph:2.2369362921,newtonsToLbf:.2248089431,
  joulesPerKcal:4184
};

const inputIds=[
  "commuteTime","commuteMinutes","commuteSeconds","commuteDate","weightPounds","distanceMiles","elevationFeet",
  "wheelDiameterInches","tirePressurePsig","deadTrafficSeconds"
];
const outputIds=[
  "movingVelocity","caloriesBurned","mechanicalPower","pedalForce",
  "overallVelocity","cadence","movingTime","gradePercent","rollingCoefficient"
];

const tabIds=["splitManager","workoutLogging","workoutTracking","admin","settings"];
const workoutElementIds=["workoutSplitSelector","strengthWorkoutDate","workoutDaySelector","workoutLoggingMessage","selectedDayDescription","warmupContainer","warmupList","workingSetsContainer","workingExerciseList","trackingMuscleGroup","trackingExerciseSelector","trackingMonth","showProgressButton","trackingResults","logCommuteButton","cyclingLogMessage","saveSettingsButton","settingsSaveStatus","newSplitButton","manageSplitsButton","splitManagerStatus","splitListView","managedSplitList","splitEditorView","splitEditorName","splitEditorDayCount","splitDayEditor","splitDaySelector","previousSplitDayButton","nextSplitDayButton","splitDayName","warmupLibrarySelector","warmupVolumeType","warmupSetsWrap","warmupSets","warmupRepsWrap","warmupRepsLabel","warmupReps","warmupCustomWrap","warmupCustomVolume","saveWarmupButton","warmupBuilderMessage","savedWarmupList","splitWorkoutType","splitWorkoutExercise","splitWorkoutSets","splitWorkoutMinLabel","splitWorkoutMin","splitWorkoutMaxLabel","splitWorkoutMax","splitWorkoutUnitHint","saveWorkoutButton","workoutBuilderMessage","savedWorkoutList","saveSplitButton","toggleCustomWorkoutButton","customWorkoutCreator","customWorkoutName","customWorkoutGroup","customWorkoutTracksWeight","customWorkoutTimed","customWorkoutNoVolume","customWorkoutHasAlternatives","customAlternativesArea","customAlternativeName","addCustomAlternativeButton","customAlternativeList","saveCustomWorkoutButton","customWorkoutMessage","splitDayOrderList","exportAllSplitsButton","importSplitsButton","importSplitsFile","inlineCyclingContainer","trackingDashboardMonth","dashboardWorkoutDays","dashboardSetCount","dashboardRideCount","dashboardExerciseCount","logDetailBackdrop","logDetailSheet","logDetailTitle","logDetailContent","closeLogDetailButton","deleteLogDetailButton","editLogDetailButton","doneLogDetailButton","trackingRange","trackingMonthWrap","customWorkoutSide","customWorkoutAssistance","refreshExerciseLibraryButton","exerciseLibrarySearch","exerciseLibrarySettingsList","exerciseLibraryEditor","exerciseEditorType","exerciseEditorHeading","exerciseEditorName","exerciseEditorGroup","exerciseEditorTracksWeight","exerciseEditorTimed","exerciseEditorNoVolume","exerciseEditorSide","exerciseEditorAssistance","exerciseEditorVariants","exerciseEditorChoiceLabel","exerciseEditorSideVariant","saveExerciseEditorButton","resetBuiltInExerciseButton","deleteCustomExerciseButton","closeExerciseEditorButton","exerciseEditorMessage","viewJamesProgressButton","publicProgressBanner","publicProgressName","exportSplitsTxtButton","exportWorkoutBackupButton","importWorkoutBackupButton","importWorkoutBackupFile","backupStatus","gymCompatibilityCard","loggingGymSelector","loggingGymEquipment","newGymButton","savedGymList","gymEditor","gymEditorTitle","closeGymEditorButton","gymNameInput","customEquipmentInput","addCustomEquipmentButton","gymEquipmentChecklist","saveAsGlobalGymWrap","saveAsGlobalGym","saveGymButton","gymEditorMessage","globalEquipmentAdmin","globalEquipmentTextarea","saveGlobalEquipmentButton","globalEquipmentMessage"];
const el=Object.fromEntries(
  [...inputIds,...outputIds,"validationMessage","advancedResults","showAdvancedResults",
   ...workoutElementIds,...tabIds.flatMap(name=>[name+"Tab",name+"Panel"])]
   .map(id=>[id,document.getElementById(id)])
);

const today=new Date();
const local=new Date(today.getTime()-today.getTimezoneOffset()*60000);
el.commuteDate.value=local.toISOString().slice(0,10);

inputIds.forEach(id=>{
  el[id].addEventListener("input",update);
  el[id].addEventListener("change",update);
});

el.showAdvancedResults.addEventListener("change",()=>{
  el.advancedResults.hidden=!el.showAdvancedResults.checked;
});


function setupTabs(){
  const activate=(target)=>{
    tabIds.forEach(name=>{
      const active=name===target;
      el[name+"Tab"].setAttribute("aria-selected",String(active));
      el[name+"Panel"].hidden=!active;
    });

    appStorage.setItem("fitnessTrackerLastTab",target);

    if(target==="workoutTracking"){
      updateTrackingDashboard();
    }

    window.scrollTo({top:0,behavior:"smooth"});
  };

  tabIds.forEach(name=>{
    el[name+"Tab"].addEventListener("click",()=>activate(name));
  });

  const saved=appStorage.getItem("fitnessTrackerLastTab");
  if(saved && tabIds.includes(saved)){
    activate(saved);
  }
}

function setupAppearance(){
  const buttons=[...document.querySelectorAll("[data-theme-choice]")];
  const media=window.matchMedia("(prefers-color-scheme: dark)");

  const apply=(choice)=>{
    if(choice==="light"||choice==="dark"){
      document.documentElement.dataset.theme=choice;
    }else{
      delete document.documentElement.dataset.theme;
    }

    buttons.forEach(button=>
      button.setAttribute("aria-pressed",String(button.dataset.themeChoice===choice))
    );

    requestAnimationFrame(()=>refreshTrackingChartsForTheme());
  };

  let saved=appStorage.getItem("fitnessTrackerAppearance")||"system";
  if(!["system","light","dark"].includes(saved)) saved="system";
  apply(saved);

  buttons.forEach(button=>{
    button.addEventListener("click",()=>{
      const choice=button.dataset.themeChoice;
      appStorage.setItem("fitnessTrackerAppearance",choice);
      apply(choice);
    });
  });

  const refreshSystem=()=>{
    if((appStorage.getItem("fitnessTrackerAppearance")||"system")==="system"){
      apply("system");
    }
  };

  if(media.addEventListener) media.addEventListener("change",refreshSystem);
  else if(media.addListener) media.addListener(refreshSystem);
}

function updateTrackingDashboard(){
  if(!el.dashboardWorkoutDays) return;

  const now=new Date();
  const month=now.getMonth();
  const year=now.getFullYear();

  const isCurrentMonth=(value)=>{
    const match=String(value||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return Boolean(match) && Number(match[1])===month+1 && Number(match[3])===year;
  };

  const workoutDates=new Set();
  const exerciseIds=new Set();
  let setCount=0;

  const trackingEntries=[];

  if(isPublicTrackingView()){
    Object.entries(publicAdminProgress.data||{}).forEach(([key,value])=>trackingEntries.push([key,value]));
  }else{
    for(let i=0;i<appStorage.length;i++){
      const key=appStorage.key(i);
      if(key) trackingEntries.push([key,appStorage.getItem(key)]);
    }
  }

  trackingEntries.forEach(([key,value])=>{
    if(!key.startsWith("workoutSetLogs:")) return;

    let logs=[];
    try{logs=JSON.parse(value||"[]")}catch{logs=[]}
    if(!Array.isArray(logs)) return;

    const monthly=logs.filter(entry=>isCurrentMonth(entry.date));
    if(monthly.length){
      exerciseIds.add(key.slice("workoutSetLogs:".length));
      monthly.forEach(entry=>workoutDates.add(entry.date));
      setCount+=monthly.length;
    }
  });

  const rides=getTrackingCyclingLogs().filter(entry=>isCurrentMonth(entry.date));
  rides.forEach(entry=>workoutDates.add(entry.date));

  el.dashboardWorkoutDays.textContent=String(workoutDates.size);
  el.dashboardSetCount.textContent=String(setCount);
  el.dashboardRideCount.textContent=String(rides.length);
  el.dashboardExerciseCount.textContent=String(exerciseIds.size);
  const monthLabel=new Intl.DateTimeFormat(undefined,{
    month:"long",year:"numeric"
  }).format(now);
  el.trackingDashboardMonth.textContent=isPublicTrackingView()
    ? `${publicAdminProgress.displayName||"James"} · ${monthLabel}`
    : monthLabel;
}

function setupWorkoutAccordion(container){
  if(!container) return;

  const cards=[...container.querySelectorAll(":scope > .logging-exercise-card")];

  cards.forEach((card,index)=>{
    if(card.dataset.accordionReady==="true") return;
    card.dataset.accordionReady="true";

    const head=card.querySelector(":scope > .logging-exercise-head");
    if(!head) return;

    const body=document.createElement("div");
    body.className="exercise-accordion-body";

    const inner=document.createElement("div");
    inner.className="accordion-inner";

    [...card.children].forEach(child=>{
      if(child!==head) inner.appendChild(child);
    });

    body.appendChild(inner);
    card.appendChild(body);

    const chevron=document.createElement("span");
    chevron.className="accordion-chevron";
    chevron.setAttribute("aria-hidden","true");
    head.appendChild(chevron);

    head.setAttribute("role","button");
    head.setAttribute("tabindex","0");
    head.setAttribute("aria-expanded","false");

    const setOpen=(open)=>{
      card.classList.toggle("accordion-open",open);
      head.setAttribute("aria-expanded",String(open));
    };

    const toggle=()=>{
      const willOpen=!card.classList.contains("accordion-open");

      if(willOpen){
        cards.forEach(other=>{
          if(other===card) return;
          other.classList.remove("accordion-open");
          const otherHead=other.querySelector(":scope > .logging-exercise-head");
          if(otherHead) otherHead.setAttribute("aria-expanded","false");
        });
      }

      setOpen(willOpen);
    };

    head.addEventListener("click",toggle);
    head.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        toggle();
      }
    });

    if(index===0) setOpen(true);
  });
}



const DRAGON_LEVELS=[
  {id:"dragon-level-1",name:"Level 1 - Lying Leg Raise",prescription:"10–15 reps"},
  {id:"dragon-level-2",name:"Level 2 - Bent-Knee Dragon Flag",prescription:"6–10 reps"},
  {id:"dragon-level-3",name:"Level 3 - Dragon Flag Negative",prescription:"3–6 slow reps"},
  {id:"dragon-level-4",name:"Level 4 - Full Dragon Flag",prescription:"4–8 reps"},
  {id:"dragon-level-5",name:"Level 5 - Full Dragon Flag (slow eccentric / pauses)",prescription:"Controlled reps"}
];

const WORKOUT_SPLITS=[
  {
    id:"james-split",
    name:"James's split",
    days:[
      {
        id:"day1",
        label:"Day 1 - Pull / Back",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Pull-Aparts","1×15"],
          ["Band External Rotations","1×12/side"],
          ["Band Shoulder Pass-Throughs","1×10–15"],
          ["Scapular Pull-Ups","1×6–10"],
          ["Prone Y/T Raises","6–8 reps each position"],
          ["First Pulling Exercise Ramp-Up","1–2 light ramp-up sets"]
        ],
        exercises:[
          {id:"cycling",name:"Cycling",prescription:"Commute",noLoad:true},
          
          {
            id:"pull-up",
            trackingId:"pull-up",
            name:"Pull-Up",
            prescription:"3×5–10",
            choiceLabel:"Grip",
            assistanceToggle:true,
            muscleGroups:["Back","Biceps"],
            options:[
              {id:"pull-up",trackingId:"pull-up",name:"Neutral Grip",variant:"Neutral Grip",noLoad:true},
              {id:"pull-up",trackingId:"pull-up",name:"Wide Grip",variant:"Wide Grip",noLoad:true}
            ]
          },
          {
            id:"lat-pulldown",
            trackingId:"lat-pulldown",
            name:"Lat Pulldown",
            prescription:"3×6–12",
            choiceLabel:"Grip",
            muscleGroups:["Back","Biceps"],
            options:[
              {id:"lat-pulldown",trackingId:"lat-pulldown",name:"Neutral Grip",variant:"Neutral Grip"},
              {id:"lat-pulldown",trackingId:"lat-pulldown",name:"Wide Grip",variant:"Wide Grip"}
            ]
          },
          {
            id:"seated-cable-row",
            trackingId:"seated-cable-row",
            name:"Seated Cable Row",
            prescription:"3×8–12",
            choiceLabel:"Grip",
            muscleGroups:["Back","Biceps"],
            options:[
              {id:"seated-cable-row",trackingId:"seated-cable-row",name:"Neutral Grip",variant:"Neutral Grip"},
              {id:"seated-cable-row",trackingId:"seated-cable-row",name:"Wide Grip",variant:"Wide Grip"}
            ]
          },
          {
            id:"chest-supported-row",
            trackingId:"chest-supported-row",
            name:"Chest-Supported Row",
            prescription:"3×8–12",
            choiceLabel:"Grip",
            muscleGroups:["Back","Biceps"],
            options:[
              {id:"chest-supported-row",trackingId:"chest-supported-row",name:"Neutral Grip",variant:"Neutral Grip"},
              {id:"chest-supported-row",trackingId:"chest-supported-row",name:"Wide Grip",variant:"Wide Grip"}
            ]
          },
          {
            id:"dumbbell-shrug",
            name:"Dumbbell Shrug",
            prescription:"3×8–15",
            muscleGroups:["Back","Shoulders"]
          },
          {
            id:"reverse-pec-deck",
            trackingId:"reverse-pec-deck",
            name:"Reverse Pec Deck",
            prescription:"3×10–15",
            choiceLabel:"Variation",
            muscleGroups:["Shoulders","Back"],
            options:[
              {id:"reverse-pec-deck",trackingId:"reverse-pec-deck",name:"One-Arm Reverse Pec Deck",variant:"One-Arm",side:true},
              {id:"reverse-pec-deck",trackingId:"reverse-pec-deck",name:"Two-Arm Reverse Pec Deck",variant:"Two-Arm",side:false}
            ]
          }
        ]
      },
      {
        
        id:"day2",
        label:"Day 2 - Lower 1 + Core",
        warmups:[
          ["Leg Swings, Front-to-Back","10/side"],
          ["Leg Swings, Side-to-Side","10/side"],
          ["Walking Knee Hugs","5/side"],
          ["Bodyweight Squats","1×10"],
          ["Bodyweight Reverse Lunges","1×6/side"],
          ["Banded Lateral Walks","10 steps each direction"],
          ["Deep Squat Hold with Gentle Shifting","20–30 sec"],
          ["High-Bar Squat Ramp-Up","2–3 progressive ramp-up sets"]
        ],
        exercises:[
          {id:"cycling",name:"Cycling",prescription:"Commute",noLoad:true},
          
          {id:"high-bar-barbell-squat",name:"High-Bar Barbell Squat",prescription:"3×5–8"},
          {id:"leg-extension",name:"Leg Extension",prescription:"3×10–15"},
          {id:"hip-abduction-machine",name:"Hip Abduction Machine",prescription:"2×12–20"},
          {id:"hip-adduction-machine",name:"Hip Adduction Machine",prescription:"2×12–20"},
          {id:"standing-calf-raise",name:"Standing Calf Raise",prescription:"3×8–15"},
          {
            name:"Crunch",
            prescription:"3×8–15",
            options:[
              {id:"machine-crunch",name:"Machine Crunch"},
              {id:"cable-crunch",name:"Cable Crunch"}
            ]
          },
          {
            id:"dragon-flag-progression",
            name:"Dragon Flag Progression",
            prescription:"3 working sets",
            levels:DRAGON_LEVELS
          }
        ]
      },
      {
        id:"day3",
        label:"Day 3 - Push + Shoulders + Triceps",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Shoulder Pass-Throughs","1×10–15"],
          ["Band External Rotations","1×12/side"],
          ["Band Pull-Aparts","1×15"],
          ["Scapular Push-Ups","1×10"],
          ["Easy Push-Ups","1×8–12"],
          ["Incline Press Ramp-Up","2–3 progressive ramp-up sets"]
        ],
        exercises:[
          {id:"cycling",name:"Cycling",prescription:"Commute",noLoad:true},
          
          {
            name:"Low-Incline Press",
            prescription:"3×6–10",
            options:[
              {id:"low-incline-dumbbell-press",name:"Low-Incline Dumbbell Press"},
              {id:"low-incline-smith-machine-press",name:"Low-Incline Smith-Machine Press"},
              {id:"low-incline-barbell-press",name:"Low-Incline Barbell Press"}
            ]
          },
          {
            name:"Shoulder Press",
            prescription:"3×6–10",
            options:[
              {id:"dumbbell-shoulder-press",name:"Dumbbell Shoulder Press"},
              {id:"machine-shoulder-press",name:"Machine Shoulder Press"}
            ]
          },
          {
            name:"Lateral / Y Raise",
            prescription:"3×12–20",
            options:[
              {id:"cable-lateral-raise",name:"Cable Lateral Raise"},
              {id:"cable-incline-y-raise",name:"Cable / Incline Y-Raise"}
            ]
          },
          {id:"overhead-cable-triceps-extension",name:"Overhead Cable Triceps Extension",prescription:"3×10–15"},
          {id:"cable-triceps-pushdown",name:"Cable Triceps Pushdown",prescription:"3×10–15"},
          {id:"wrist-curl",name:"Wrist Curl",prescription:"2×12–20",side:true}
        ]
      },
      {
        id:"day4",
        label:"Day 4 - Lower 2 + Core",
        warmups:[
          ["Leg Swings, Front-to-Back","10/side"],
          ["Leg Swings, Side-to-Side","10/side"],
          ["Bodyweight Good Mornings / Hip Hinges","1×10"],
          ["Glute Bridges","1×10–12"],
          ["Bodyweight Squats","1×10"],
          ["Banded Lateral Walks","10 steps each direction"],
          ["Alternating Hamstring Sweeps","6/side"],
          ["Romanian Deadlift Ramp-Up","2–3 progressive ramp-up sets"]
        ],
        exercises:[
          {id:"cycling",name:"Cycling",prescription:"Commute",noLoad:true},
          
          {id:"romanian-deadlift",name:"Romanian Deadlift",prescription:"3×6–10"},
          {
            name:"Squat",
            prescription:"3×8–12",
            options:[
              {id:"hack-squat",name:"Hack Squat"},
              {id:"smith-machine-squat",name:"Smith-Machine Squat"}
            ]
          },
          {id:"seated-hamstring-curl",name:"Seated Hamstring Curl",prescription:"3×8–15"},
          {id:"erector-biased-weighted-hyperextension",name:"Erector-Biased Weighted Hyperextension",prescription:"3×8–15"},
          {id:"cable-woodchop",name:"Cable Woodchop",prescription:"3×10–15/side",side:true},
          {id:"copenhagen-plank",name:"Copenhagen Plank",prescription:"2×20–45 sec/side",side:true,noLoad:true,repsLabel:"Seconds"}
        ]
      },
      {
        id:"day5",
        label:"Day 5 - Chest + Biceps",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Shoulder Pass-Throughs","1×10–15"],
          ["Band External Rotations","1×12/side"],
          ["Band Pull-Aparts","1×15"],
          ["Scapular Push-Ups","1×10"],
          ["Easy Push-Ups","1×8–12"],
          ["Machine Dip Ramp-Up","1–2 progressive ramp-up sets if needed"]
        ],
        exercises:[
          {id:"cycling",name:"Cycling",prescription:"Commute",noLoad:true},
          
          {
            name:"Chest-Biased Dip",
            prescription:"3×6–12",
            options:[
              {id:"chest-biased-machine-dip",name:"Chest-Biased Machine Dip"},
              {id:"weighted-chest-biased-dip",name:"Weighted Chest-Biased Dip"}
            ]
          },
          {
            name:"Chest Fly",
            prescription:"3×10–15",
            options:[
              {id:"cable-pec-fly",name:"Cable Pec Fly"},
              {id:"pec-deck",name:"Pec Deck"}
            ]
          },
          {id:"face-away-bayesian-cable-curl",name:"Face-Away Bayesian Cable Curl",prescription:"3×8–12"},
          {
            name:"Supinated Preacher Curl",
            prescription:"3×8–12",
            options:[
              {id:"supinated-machine-preacher-curl",name:"Supinated Machine Preacher Curl"},
              {id:"supinated-cable-preacher-curl",name:"Supinated Cable Preacher Curl"}
            ]
          },
          {id:"preacher-hammer-curl",name:"Preacher Hammer Curl",prescription:"3×10–15"},
          {id:"wrist-extension",name:"Wrist Extension",prescription:"2×12–20",side:true}
        ]
      }
    ]
  },
  {
    id:"nia-split",
    name:"Nia's split",
    days:[
      {
        id:"day1",
        label:"Day 1 - Pull / Back",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Pull-Aparts","15 reps"],
          ["Band External Rotations","12/side"],
          ["Band Shoulder Pass-Throughs","10–15 reps"],
          ["Scapular Pull-Ups","6–10 reps"],
          ["Prone Y/T Raises","6–8 reps each position"],
          ["First Pulling Exercise Ramp-Up","Progressive ramp-up sets before first heavy compound"]
        ],
        exercises:[
          {
            name:"Vertical Pull",
            prescription:"3×6–12",
            note:"Choose whichever variation allows controlled progression. Use a controlled stretch at the top.",
            options:[
              {id:"lat-pulldown",name:"Lat Pulldown"},
              {id:"assisted-pull-up",name:"Assisted Pull-Up"}
            ]
          },
          {
            id:"seated-cable-row",
            name:"Seated Cable Row",
            prescription:"3×8–12",
            note:"Keep the torso controlled. Pull through the elbows rather than using momentum."
          },
          {
            id:"neutral-grip-machine-row",
            name:"Neutral-Grip Machine Row",
            prescription:"3×8–12",
            note:"Use a comfortable full ROM and control the eccentric portion."
          },
          {
            id:"single-arm-rear-delt-fly",
            name:"Single-Arm Rear-Delt Fly",
            prescription:"3×10–15/arm",
            side:true,
            note:"Keep the movement rear-delt focused and avoid rotating the torso to move more weight."
          },
          {
            id:"erector-biased-hyperextension",
            name:"Erector-Biased Hyperextension",
            prescription:"3×8–15",
            note:"Emphasize controlled spinal extension. Stop around neutral and avoid turning it into a glute-dominant hip extension."
          }
        ]
      },
      {
        id:"day2",
        label:"Day 2 - Lower 1 + Core",
        warmups:[
          ["Leg Swings, Front-to-Back","10/side"],
          ["Leg Swings, Side-to-Side","10/side"],
          ["Walking Knee Hugs","5/side"],
          ["Bodyweight Squats","10 reps"],
          ["Bodyweight Reverse Lunges","6/side"],
          ["Glute Bridges","10–12 reps"],
          ["Banded Lateral Walks","10 steps each direction"],
          ["Deep Squat Hold with Gentle Shifting","20–30 sec"],
          ["First Heavy Compound Ramp-Up","Progressive ramp-up sets before Smith-Machine Squat"]
        ],
        exercises:[
          {
            id:"smith-machine-squat",
            name:"Smith-Machine Squat",
            prescription:"3×6–10",
            note:"Use a controlled, comfortable depth and keep foot placement consistent between sessions."
          },
          {
            id:"leg-press",
            name:"Leg Press",
            prescription:"3×8–12",
            note:"Use controlled depth. Avoid excessive pelvic curling away from the pad at the bottom."
          },
          {
            id:"glute-bridge",
            name:"Glute Bridge",
            prescription:"3×8–12",
            note:"Pause and contract the glutes at the top. Avoid excessive lumbar hyperextension."
          },
          {
            id:"leg-extension",
            name:"Leg Extension",
            prescription:"3×10–15",
            note:"Control both lifting and lowering and use comfortable full knee-extension ROM."
          },
          {
            id:"hip-abduction-machine",
            name:"Hip Abduction Machine",
            prescription:"2–3×12–20",
            note:"Control the return and avoid bouncing the weight."
          },
          {
            id:"standing-calf-raise",
            name:"Standing Calf Raise",
            prescription:"3×8–15",
            note:"Pause in a deep stretch at the bottom and use full plantar flexion at the top."
          },
          {
            name:"Crunch",
            prescription:"3×8–15",
            note:"Focus on spinal flexion and progressive overload.",
            options:[
              {id:"machine-crunch",name:"Machine Crunch"},
              {id:"cable-crunch",name:"Cable Crunch"}
            ]
          }
        ]
      },
      {
        id:"day3",
        label:"Day 3 - Push + Triceps / Shoulders",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Shoulder Pass-Throughs","10–15 reps"],
          ["Band External Rotations","12/side"],
          ["Band Pull-Aparts","15 reps"],
          ["Scapular Push-Ups","10 reps"],
          ["Easy Push-Ups","8–12 reps"],
          ["First Heavy Compound Ramp-Up","Progressive ramp-up sets before Incline Dumbbell Press"]
        ],
        exercises:[
          {
            id:"incline-dumbbell-press",
            name:"Incline Dumbbell Press",
            prescription:"3×6–10",
            note:"Use a moderate incline, control the eccentric, and use a comfortable full ROM."
          },
          {
            id:"dumbbell-shoulder-press",
            name:"Dumbbell Shoulder Press",
            prescription:"3×6–10",
            note:"Avoid excessive lower-back arching and keep the movement controlled."
          },
          {
            id:"cable-lateral-raise",
            name:"Cable Lateral Raise",
            prescription:"3×12–20",
            note:"Keep tension on the lateral delts and avoid using momentum."
          },
          {
            id:"overhead-cable-triceps-extension",
            name:"Overhead Cable Triceps Extension",
            prescription:"3×10–15",
            note:"Emphasize the long head of the triceps and allow a controlled stretch."
          },
          {
            id:"cable-triceps-pushdown",
            name:"Cable Triceps Pushdown",
            prescription:"3×10–15",
            note:"Keep the upper arms relatively stationary and control the eccentric."
          }
        ]
      },
      {
        id:"day4",
        label:"Day 4 - Lower 2",
        warmups:[
          ["Leg Swings, Front-to-Back","10/side"],
          ["Leg Swings, Side-to-Side","10/side"],
          ["Bodyweight Good Mornings / Hip Hinges","10 reps"],
          ["Glute Bridges","10–12 reps"],
          ["Bodyweight Reverse Lunges","6/side"],
          ["Banded Lateral Walks","10 steps each direction"],
          ["Alternating Hamstring Sweeps","6/side"],
          ["First Heavy Compound Ramp-Up","Progressive ramp-up sets before Romanian Deadlift"]
        ],
        exercises:[
          {
            id:"romanian-deadlift",
            name:"Romanian Deadlift",
            prescription:"3×6–10",
            note:"Hinge through the hips, control the eccentric, and prioritize a strong loaded hamstring stretch."
          },
          {
            id:"bulgarian-split-squat",
            name:"Bulgarian Split Squat",
            prescription:"3×8–12/leg",
            side:true,
            note:"Use controlled depth and consistent foot placement. A slight forward torso angle can emphasize the glutes."
          },
          {
            id:"glute-bridge",
            name:"Glute Bridge",
            prescription:"3×8–12",
            note:"Pause and squeeze at the top and avoid excessive lumbar extension."
          },
          {
            id:"hamstring-curl",
            name:"Hamstring Curl",
            prescription:"3×8–15",
            note:"Control both the shortened and lengthened positions."
          },
          {
            id:"hip-abduction-machine",
            name:"Hip Abduction Machine",
            prescription:"2×12–20",
            note:"Control the return rather than bouncing."
          },
          {
            id:"hip-adduction-machine",
            name:"Hip Adduction Machine",
            prescription:"2×12–20",
            note:"Perform immediately after abduction when practical and use a controlled stretch."
          },
          {
            id:"glute-biased-rounded-back-hyperextension",
            name:"Glute-Biased Rounded-Back Hyperextension",
            prescription:"3×10–15",
            note:"Drive primarily through hip extension, emphasize the glutes, and avoid aggressive hyperextension at the top."
          }
        ]
      },
      {
        id:"day5",
        label:"Day 5 - Chest / Shoulders / Biceps + Core",
        warmups:[
          ["Arm Circles","10 forward + 10 backward"],
          ["Band Shoulder Pass-Throughs","10–15 reps"],
          ["Band External Rotations","12/side"],
          ["Band Pull-Aparts","15 reps"],
          ["Scapular Push-Ups","10 reps"],
          ["Easy Push-Ups","8–12 reps"],
          ["First Heavy Compound Ramp-Up","Progressive ramp-up sets before Shoulder-Press Machine"]
        ],
        exercises:[
          {
            id:"shoulder-press-machine",
            name:"Shoulder-Press Machine",
            prescription:"3×6–10",
            note:"Use a controlled ROM and avoid excessive lower-back arching."
          },
          {
            id:"pec-deck-fly",
            name:"Pec-Deck Fly",
            prescription:"3×10–15",
            note:"Use a controlled stretch and contraction and keep the movement chest-driven."
          },
          {
            id:"face-away-bayesian-cable-curl",
            name:"Face-Away Bayesian Cable Curl",
            prescription:"3×8–12",
            note:"Emphasizes the biceps in the lengthened position with a strong long-head stimulus."
          },
          {
            id:"supinated-machine-preacher-curl",
            name:"Supinated Machine Preacher Curl",
            prescription:"3×8–12",
            note:"Use a controlled stretched position for direct biceps / short-head emphasis."
          },
          {
            id:"preacher-hammer-curl",
            name:"Preacher Hammer Curl",
            prescription:"3×10–15",
            note:"Emphasize the brachialis and brachioradialis and maintain a neutral grip."
          },
          {
            id:"roman-chair-leg-raise",
            name:"Roman-Chair Leg Raise",
            prescription:"3×10–20",
            noLoad:true,
            note:"Curl the pelvis upward rather than only lifting the legs and avoid excessive swinging."
          }
        ]
      }
    ]
  }
];

function getWorkoutSplit(splitId){
  const builtIn=WORKOUT_SPLITS.find(split=>split.id===splitId) || null;

  if(builtIn){
    const override=getCustomSplits().find(split=>split.id===splitId);
    const resolved=override ? convertManagerSplitToWorkoutLoggingSplit(override) : deepClone(builtIn);
    return applyLibraryDefinitionsToLoggingSplit(ensureBuiltInLoggingActivities(resolved));
  }

  const custom=getCustomSplits().find(split=>split.id===splitId);
  return custom ? convertManagerSplitToWorkoutLoggingSplit(custom) : null;
}

function applyLibraryDefinitionsToLoggingSplit(split){
  if(!split) return split;
  const library=getManagerExerciseLibrary();

  (split.days||[]).forEach(day=>{
    (day.exercises||[]).forEach(exercise=>{
      const id=exercise.trackingId||exercise.id;
      const definition=library.find(item=>item.id===id);
      if(!definition) return;

      exercise.name=definition.name||exercise.name;
      exercise.noLoad=definition.tracksWeight===false;
      exercise.assistanceToggle=Boolean(definition.assistanceToggle);
      exercise.side=Boolean(definition.side);
      exercise.choiceLabel=definition.choiceLabel||exercise.choiceLabel||"Variation";

      if(definition.unit==="seconds") exercise.repsLabel="Seconds";

      if(Array.isArray(definition.variants)&&definition.variants.length){
        exercise.options=definition.variants.map(variant=>({
          id:definition.id,
          trackingId:definition.id,
          name:variant,
          variant,
          noLoad:definition.tracksWeight===false,
          side:Boolean(definition.side || (definition.sideVariant&&definition.sideVariant===variant))
        }));
      }
    });
  });

  return split;
}

function ensureBuiltInLoggingActivities(split){
  if(!split || split.id!=="james-split") return split;

  split.days.forEach(day=>{
    if(!Array.isArray(day.exercises)) day.exercises=[];
    const hasCycling=day.exercises.some(exercise=>
      exercise &&
      (exercise.id==="cycling" ||
       exercise.trackingId==="cycling" ||
       String(exercise.name||"").trim().toLowerCase()==="cycling")
    );

    if(!hasCycling){
      day.exercises.unshift({
        id:"cycling",
        trackingId:"cycling",
        name:"Cycling",
        prescription:"Commute",
        noLoad:true
      });
    }else{
      const cyclingIndex=day.exercises.findIndex(exercise=>
        exercise &&
        (exercise.id==="cycling" ||
         exercise.trackingId==="cycling" ||
         String(exercise.name||"").trim().toLowerCase()==="cycling")
      );

      if(cyclingIndex>0){
        const [cycling]=day.exercises.splice(cyclingIndex,1);
        day.exercises.unshift(cycling);
      }
    }
  });

  return split;
}

function getSelectedWorkoutSplit(){
  return getWorkoutSplit(el.workoutSplitSelector.value);
}

function convertManagerSplitToWorkoutLoggingSplit(split){
  return {
    id:split.id,
    name:split.name,
    days:(split.days||[]).map((day,index)=>({
      id:day.id || `day${index+1}`,
      label:`Day ${index+1} - ${day.name || `Day ${index+1}`}`,
      warmups:(day.warmups||[]).map(warmup=>[
        warmup.name,
        warmup.display || warmup.custom || ""
      ]),
      exercises:(day.workouts||[]).map(workout=>convertManagerWorkoutToLoggingExercise(workout))
    }))
  };
}

function convertManagerWorkoutToLoggingExercise(workout){
  const libraryExercise=getManagerExerciseLibrary().find(item=>item.id===workout.exerciseId);
  const source=libraryExercise || workout;

  const exercise={
    id:workout.exerciseId,
    trackingId:workout.exerciseId,
    name:workout.name || source.name || "Exercise",
    prescription:workout.display || managerWorkoutPrescription(workout),
    noLoad:source.tracksWeight===false,
    assistanceToggle:Boolean(source.assistanceToggle),
    side:Boolean(source.side),
    choiceLabel:source.choiceLabel || workout.choiceLabel || "Variation"
  };

  const variants=Array.isArray(source.variants)&&source.variants.length
    ? source.variants
    : (Array.isArray(workout.variants)?workout.variants:[]);

  if(variants.length){
    exercise.options=variants.map(variant=>({
      id:workout.exerciseId,
      trackingId:workout.exerciseId,
      name:variant,
      variant,
      noLoad:source.tracksWeight===false,
      side:Boolean(source.side || (source.sideVariant && source.sideVariant===variant))
    }));
  }

  if(workout.unit==="seconds"){
    exercise.repsLabel="Seconds";
  }

  return exercise;
}

function managerWorkoutPrescription(workout){
  if(workout.noVolume) return "No prescribed volume";

  const suffix=workout.unit==="seconds" ? " sec" : "";
  return `${workout.sets||1}×${workout.rangeMin||1}–${workout.rangeMax||1}${suffix}`;
}



const CUSTOM_EXERCISES_STORAGE_KEY="fitnessTrackerCustomExercises";
let BUILT_IN_EXERCISE_OVERRIDES={};

window.setBuiltInExerciseOverrides=function(overrides){
  BUILT_IN_EXERCISE_OVERRIDES=overrides&&typeof overrides==="object"?overrides:{};
};

const MANAGER_EXERCISE_LIBRARY=[
  {id:"cycling",name:"Cycling",group:"Cardio",unit:"none",noVolume:true,tracksWeight:false,variants:[]},
  {id:"treadmill",name:"Treadmill",group:"Cardio",unit:"none",noVolume:true,tracksWeight:false,variants:[]},

  {id:"flat-press",name:"Flat Press",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Barbell","Dumbbell","Smith Machine","Machine"]},
  {id:"incline-press",name:"Incline Press",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Barbell","Dumbbell","Smith Machine","Machine"]},
  {id:"barbell-squat",name:"Barbell Squat",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Style",
    variants:["High Bar","Low Bar","Machine"]},
  {id:"smith-machine-squat",name:"Smith Machine Squat",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Style",
    variants:["High Bar","Low Bar","Machine"]},
  {id:"deadlift",name:"Deadlift",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Stance",
    variants:["Standard","Sumo"]},
  {id:"romanian-deadlift",name:"Romanian Deadlift",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Barbell","Dumbbell"]},
  {id:"shoulder-press",name:"Shoulder Press",group:"Compound",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Dumbbell","Machine"]},
  {id:"pull-ups",name:"Pull-Ups",group:"Compound",unit:"reps",tracksWeight:false,assistanceToggle:true,variants:[]},

  {id:"chest-supported-row",name:"Chest-Supported Row",group:"Back",unit:"reps",tracksWeight:true,choiceLabel:"Grip",
    variants:["Wide Grip","Neutral Grip"]},
  {id:"dumbbell-shrug",name:"Dumbbell Shrug",group:"Back",unit:"reps",tracksWeight:true,variants:[]},
  {id:"lat-pulldown",name:"Lat Pulldown",group:"Back",unit:"reps",tracksWeight:true,choiceLabel:"Grip",
    variants:["Wide Grip","Neutral Grip"]},
  {id:"reverse-pec-deck",name:"Reverse Pec Deck",group:"Back",unit:"reps",tracksWeight:true,choiceLabel:"Arms",
    variants:["One Arm","Two Arm"],sideVariant:"One Arm"},
  {id:"seated-cable-row",name:"Seated Cable Row",group:"Back",unit:"reps",tracksWeight:true,choiceLabel:"Grip",
    variants:["Wide Grip","Neutral Grip"]},
  {id:"erector-biased-hyperextension",name:"Erector-Biased Hyperextension",group:"Back",unit:"reps",tracksWeight:true,variants:[]},

  {id:"bayesian-cable-curl",name:"Bayesian Cable Curl",group:"Biceps",unit:"reps",tracksWeight:true,choiceLabel:"Arms",
    variants:["One Arm","Two Arm"],sideVariant:"One Arm"},
  {id:"hammer-preacher-curl",name:"Hammer Preacher Curl",group:"Biceps",unit:"reps",tracksWeight:true,variants:[]},
  {id:"supinated-preacher-curl",name:"Supinated Preacher Curl",group:"Biceps",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Dumbbell","Machine"]},

  {id:"pec-fly",name:"Pec Fly",group:"Chest",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Pec Deck","Cable"]},
  {id:"chest-biased-dip",name:"Chest-Biased Dip",group:"Chest",unit:"reps",tracksWeight:false,assistanceToggle:true,variants:[]},

  {id:"lateral-raises",name:"Lateral Raises",group:"Shoulders",unit:"reps",tracksWeight:true,side:true,choiceLabel:"Equipment",
    variants:["Cable","Dumbbell"]},

  {id:"cable-pushdown",name:"Cable Pushdown",group:"Triceps",unit:"reps",tracksWeight:true,variants:[]},
  {id:"overhead-cable-extension",name:"Overhead Cable Extension",group:"Triceps",unit:"reps",tracksWeight:true,variants:[]},
  {id:"tricep-biased-dip",name:"Tricep-Biased Dip",group:"Triceps",unit:"reps",tracksWeight:false,assistanceToggle:true,variants:[]},

  {id:"wrist-curl",name:"Wrist Curl",group:"Forearms",unit:"reps",tracksWeight:true,variants:[]},
  {id:"wrist-extension",name:"Wrist Extension",group:"Forearms",unit:"reps",tracksWeight:true,variants:[]},

  {id:"bulgarian-split-squat",name:"Bulgarian Split Squat",group:"Quadriceps",unit:"reps",tracksWeight:true,side:true,variants:[]},
  {id:"hack-squat",name:"Hack Squat",group:"Quadriceps",unit:"reps",tracksWeight:true,variants:[]},
  {id:"leg-extension",name:"Leg Extension",group:"Quadriceps",unit:"reps",tracksWeight:true,variants:[]},
  {id:"leg-press",name:"Leg Press",group:"Quadriceps",unit:"reps",tracksWeight:true,choiceLabel:"Machine",
    variants:["Incline","Horizontal"]},

  {id:"hamstring-curl",name:"Hamstring Curl",group:"Hamstrings",unit:"reps",tracksWeight:true,choiceLabel:"Position",
    variants:["Seated","Lying"]},

  {id:"glute-bridge",name:"Glute Bridge",group:"Glutes",unit:"reps",tracksWeight:true,variants:[]},
  {id:"glute-biased-hyperextension",name:"Glute-Biased Hyperextension",group:"Glutes",unit:"reps",tracksWeight:true,variants:[]},
  {id:"hip-abduction",name:"Hip Abduction",group:"Glutes",unit:"reps",tracksWeight:true,variants:[]},
  {id:"hip-adduction",name:"Hip Adduction",group:"Glutes",unit:"reps",tracksWeight:true,variants:[]},

  {id:"calf-raises",name:"Calf Raises",group:"Calves",unit:"reps",tracksWeight:true,choiceLabel:"Position",
    variants:["Standing","Seated"]},

  {id:"crunches",name:"Crunches",group:"Core",unit:"reps",tracksWeight:true,choiceLabel:"Equipment",
    variants:["Cable","Machine"]},
  {id:"cable-woodchop",name:"Cable Woodchop",group:"Core",unit:"reps",tracksWeight:true,side:true,variants:[]},
  {id:"ab-wheel-rollout",name:"Ab Wheel Rollout",group:"Core",unit:"reps",tracksWeight:false,variants:[]},
  {id:"copenhagen-plank",name:"Copenhagen Plank",group:"Core",unit:"seconds",tracksWeight:false,side:true,variants:[]},
  {id:"dragon-flag-progression",name:"Dragon Flag Progression",group:"Core",unit:"reps",tracksWeight:false,choiceLabel:"Level",
    variants:["Level 1 - Lying Leg Raise","Level 2 - Bent-Knee Dragon Flag","Level 3 - Dragon Flag Negative",
              "Level 4 - Full Dragon Flag","Level 5 - Full Dragon Flag (slow eccentric / pauses)"]}
];

function getCustomExerciseLibrary(){
  try{
    const data=JSON.parse(appStorage.getItem(CUSTOM_EXERCISES_STORAGE_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function saveCustomExerciseLibrary(exercises){
  appStorage.setItem(CUSTOM_EXERCISES_STORAGE_KEY,JSON.stringify(exercises));
}

function getManagerExerciseLibrary(){
  const builtIns=MANAGER_EXERCISE_LIBRARY.map(exercise=>({
    ...exercise,
    ...(BUILT_IN_EXERCISE_OVERRIDES[exercise.id]||{}),
    id:exercise.id,
    custom:false
  }));
  return [...builtIns,...getCustomExerciseLibrary()];
}

const CUSTOM_SPLITS_STORAGE_KEY="fitnessTrackerCustomSplits";
let splitEditorDraft=null;
let splitEditorCurrentDayIndex=0;
let editingWarmupId=null;
let editingWorkoutId=null;

function setupSplitManager(){
  populateWarmupManagerLibrary();
  el.newSplitButton.addEventListener("click",startNewSplit);
  el.manageSplitsButton.addEventListener("click",showManagedSplits);
  el.exportAllSplitsButton.addEventListener("click",exportAllManagedSplits);
  el.exportSplitsTxtButton.addEventListener("click",exportSplitsAsChatGPTText);
  el.importSplitsButton.addEventListener("click",()=>el.importSplitsFile.click());
  el.importSplitsFile.addEventListener("change",handleSplitImportFile);

  el.splitEditorDayCount.addEventListener("change",()=>{
    const count=Number(el.splitEditorDayCount.value);
    if(!Number.isInteger(count)||count<1||count>7){el.splitDayEditor.hidden=true;return}
    ensureSplitDraftExists(); resizeSplitDraftDays(count);
    splitEditorCurrentDayIndex=Math.min(splitEditorCurrentDayIndex,count-1); renderSplitDayEditor();
  });

  el.splitEditorName.addEventListener("input",()=>{ensureSplitDraftExists();splitEditorDraft.name=el.splitEditorName.value});
  el.splitDaySelector.addEventListener("change",()=>{persistCurrentSplitDayName();splitEditorCurrentDayIndex=Number(el.splitDaySelector.value)||0;renderSplitDayEditor()});
  el.previousSplitDayButton.addEventListener("click",()=>{persistCurrentSplitDayName();if(splitEditorCurrentDayIndex>0){splitEditorCurrentDayIndex--;renderSplitDayEditor()}});
  el.nextSplitDayButton.addEventListener("click",()=>{persistCurrentSplitDayName();if(splitEditorDraft&&splitEditorCurrentDayIndex<splitEditorDraft.days.length-1){splitEditorCurrentDayIndex++;renderSplitDayEditor()}});
  el.splitDayName.addEventListener("input",persistCurrentSplitDayName);

  el.warmupVolumeType.addEventListener("change",updateWarmupVolumeInputs);
  el.saveWarmupButton.addEventListener("click",saveWarmupToDraftDay);
  el.splitWorkoutType.addEventListener("change",populateSplitWorkoutOptions);
  el.splitWorkoutExercise.addEventListener("change",updateSplitWorkoutVolumeUnit);
  el.saveWorkoutButton.addEventListener("click",saveWorkoutToDraftDay);
  el.saveSplitButton.addEventListener("click",saveCurrentSplitDraft);

  el.toggleCustomWorkoutButton.addEventListener("click",()=>{
    el.customWorkoutCreator.hidden=!el.customWorkoutCreator.hidden;
    el.toggleCustomWorkoutButton.textContent=el.customWorkoutCreator.hidden?"+ Create Custom Workout":"Hide Custom Workout Creator";
  });

  el.customWorkoutHasAlternatives.addEventListener("change",()=>{
    el.customAlternativesArea.hidden=!el.customWorkoutHasAlternatives.checked;
    if(!el.customWorkoutHasAlternatives.checked){
      customWorkoutAlternativeDraft=[];
      renderCustomAlternativeDraft();
    }
  });

  el.customWorkoutNoVolume.addEventListener("change",()=>{
    if(el.customWorkoutNoVolume.checked){
      el.customWorkoutTracksWeight.checked=false;
      el.customWorkoutTimed.checked=false;
    }
  });

  el.addCustomAlternativeButton.addEventListener("click",addCustomWorkoutAlternative);
  el.saveCustomWorkoutButton.addEventListener("click",saveCustomWorkoutToLibrary);

  updateWarmupVolumeInputs();
}


let customWorkoutAlternativeDraft=[];

function addCustomWorkoutAlternative(){
  el.customWorkoutMessage.textContent="";
  const name=el.customAlternativeName.value.trim();
  if(!name){
    el.customWorkoutMessage.textContent="Enter an alternative / variation name.";
    return;
  }

  customWorkoutAlternativeDraft.push(name);
  el.customAlternativeName.value="";
  renderCustomAlternativeDraft();
}

function renderCustomAlternativeDraft(){
  el.customAlternativeList.innerHTML="";

  if(!customWorkoutAlternativeDraft.length){
    return;
  }

  customWorkoutAlternativeDraft.forEach((name,index)=>{
    const row=document.createElement("div");
    row.className="builder-saved-item";

    const copy=document.createElement("div");
    copy.className="builder-saved-copy";
    copy.innerHTML=`<strong>${escapeHtml(name)}</strong><span>Variation ${index+1}</span>`;

    const remove=document.createElement("button");
    remove.type="button";
    remove.className="builder-delete-button";
    remove.textContent="🗑";
    remove.addEventListener("click",()=>{
      customWorkoutAlternativeDraft.splice(index,1);
      renderCustomAlternativeDraft();
    });

    row.append(copy,remove);
    el.customAlternativeList.appendChild(row);
  });
}

function saveCustomWorkoutToLibrary(){
  el.customWorkoutMessage.textContent="";

  const name=el.customWorkoutName.value.trim();
  const group=el.customWorkoutGroup.value;

  if(!name){
    el.customWorkoutMessage.textContent="Enter a workout name.";
    return;
  }
  if(!group){
    el.customWorkoutMessage.textContent="Choose a workout group.";
    return;
  }

  if(el.customWorkoutHasAlternatives.checked && !customWorkoutAlternativeDraft.length){
    el.customWorkoutMessage.textContent="Add at least one alternative / variation.";
    return;
  }

  const id=`custom-${slugifyManagerName(name)}-${Date.now()}`;
  const noVolume=el.customWorkoutNoVolume.checked;

  const exercise={
    id,
    name,
    group,
    unit:noVolume?"none":(el.customWorkoutTimed.checked?"seconds":"reps"),
    noVolume,
    tracksWeight:noVolume?false:el.customWorkoutTracksWeight.checked,
    side:Boolean(el.customWorkoutSide.checked),
    assistanceToggle:Boolean(el.customWorkoutAssistance.checked),
    variants:el.customWorkoutHasAlternatives.checked?customWorkoutAlternativeDraft.slice():[],
    choiceLabel:el.customWorkoutHasAlternatives.checked?"Variation":null,
    custom:true,
    createdAt:Date.now()
  };

  const library=getCustomExerciseLibrary();
  library.push(exercise);
  saveCustomExerciseLibrary(library);

  el.customWorkoutName.value="";
  el.customWorkoutGroup.value="";
  el.customWorkoutTracksWeight.checked=true;
  el.customWorkoutTimed.checked=false;
  el.customWorkoutNoVolume.checked=false;
  el.customWorkoutSide.checked=false;
  el.customWorkoutAssistance.checked=false;
  el.customWorkoutHasAlternatives.checked=false;
  el.customAlternativesArea.hidden=true;
  customWorkoutAlternativeDraft=[];
  renderCustomAlternativeDraft();

  el.customWorkoutMessage.style.color="var(--success)";
  el.customWorkoutMessage.textContent=`Saved "${name}" to the exercise library.`;

  if(el.splitWorkoutType.value===group){
    populateSplitWorkoutOptions();
  }
}

function startNewSplit(){
  splitEditorDraft={id:makeSplitManagerId(),name:"",days:[],createdAt:Date.now(),updatedAt:Date.now()};
  splitEditorCurrentDayIndex=0; el.splitListView.hidden=true;el.splitEditorView.hidden=false;el.splitDayEditor.hidden=true;
  el.splitEditorName.value="";el.splitEditorDayCount.value="";resetSplitBuilderForms();
  setSplitManagerStatus("Creating a new split. Choose a name and the number of workout days.");el.splitEditorName.focus();
}

function showManagedSplits(){clearSplitManagerStatus();el.splitEditorView.hidden=true;el.splitListView.hidden=false;renderManagedSplitList()}


function getEffectiveManagedSplits(){
  const customSplits=getCustomSplits();
  const builtInIds=new Set(WORKOUT_SPLITS.map(split=>split.id));
  const overrides=new Map(
    customSplits
      .filter(split=>builtInIds.has(split.id))
      .map(split=>[split.id,split])
  );

  return [
    ...WORKOUT_SPLITS.map(split=>
      deepClone(overrides.get(split.id) || convertBuiltInSplitToManagerDraft(split))
    ),
    ...customSplits
      .filter(split=>!builtInIds.has(split.id))
      .map(split=>deepClone(split))
  ];
}

function buildSplitExportPackage(splits){
  const usedCustomExerciseIds=new Set();

  splits.forEach(split=>{
    (split.days||[]).forEach(day=>{
      (day.workouts||[]).forEach(workout=>{
        if(String(workout.exerciseId||"").startsWith("custom-")){
          usedCustomExerciseIds.add(workout.exerciseId);
        }
      });
    });
  });

  const customExercises=getCustomExerciseLibrary()
    .filter(exercise=>usedCustomExerciseIds.has(exercise.id));

  return {
    format:"fitness-progress-tracker-splits",
    version:1,
    exportedAt:new Date().toISOString(),
    splits:deepClone(splits),
    customExercises:deepClone(customExercises)
  };
}

function exportAllManagedSplits(){
  const splits=getEffectiveManagedSplits();
  downloadSplitJson(
    buildSplitExportPackage(splits),
    `fitness-progress-tracker-splits-${managerDateStamp()}.json`
  );
  setSplitManagerStatus(`Exported ${splits.length} split${splits.length===1?"":"s"}.`);
}

function exportSplitsAsChatGPTText(){
  const splits=getEffectiveManagedSplits();
  const text=splits.map(split=>splitToChatGPTText(split)).join("\n\n---\n\n");
  downloadTextFile(text,`fitness-workout-splits-${managerDateStamp()}.txt`);
  setSplitManagerStatus(`Exported ${splits.length} split${splits.length===1?"":"s"} as ChatGPT-friendly text.`);
}

function splitToChatGPTText(split){
  const lines=[
    `# ${split.name}`,
    "",
    "| Day | Section | Exercise | Prescription | Variations / Notes |",
    "|---|---|---|---|---|"
  ];

  (split.days||[]).forEach((day,index)=>{
    const dayName=`Day ${index+1} — ${day.name||`Day ${index+1}`}`;

    (day.warmups||[]).forEach(warmup=>{
      lines.push(`| ${escapeTable(dayName)} | Warm-Up | ${escapeTable(warmup.name||"")} | ${escapeTable(warmup.display||warmup.custom||"")} | |`);
    });

    (day.workouts||[]).forEach(workout=>{
      const variations=Array.isArray(workout.variants)&&workout.variants.length
        ? workout.variants.join(", ")
        : "";
      lines.push(`| ${escapeTable(dayName)} | Workout | ${escapeTable(workout.name||"")} | ${escapeTable(workout.display||managerWorkoutPrescription(workout))} | ${escapeTable(variations)} |`);
    });
  });

  return lines.join("\n");
}

function escapeTable(value){
  return String(value??"").replace(/\|/g,"\\|").replace(/\r?\n/g," ");
}

function downloadTextFile(text,filename){
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportManagedSplit(id,kind){
  let split=null;

  if(kind==="builtIn"){
    const override=getCustomSplits().find(item=>item.id===id);
    const builtIn=WORKOUT_SPLITS.find(item=>item.id===id);
    split=override || (builtIn ? convertBuiltInSplitToManagerDraft(builtIn) : null);
  }else{
    split=getCustomSplits().find(item=>item.id===id) || null;
  }

  if(!split){
    setSplitManagerStatus("Unable to export that split.",true);
    return;
  }

  const safeName=slugifyManagerName(split.name)||"workout-split";
  downloadSplitJson(
    buildSplitExportPackage([split]),
    `${safeName}-${managerDateStamp()}.json`
  );
  setSplitManagerStatus(`Exported "${split.name}".`);
}

function downloadSplitJson(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function handleSplitImportFile(){
  const file=el.importSplitsFile.files && el.importSplitsFile.files[0];
  el.importSplitsFile.value="";
  if(!file) return;

  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    const payload=normalizeImportedSplitPayload(parsed);

    if(!payload.splits.length){
      throw new Error("The JSON file does not contain any workout splits.");
    }

    const invalid=payload.splits.find(split=>!isValidImportedSplit(split));
    if(invalid){
      throw new Error(`"${invalid.name||"Unnamed split"}" is not a valid split.`);
    }

    importCustomExercises(payload.customExercises||[]);
    importManagedSplits(payload.splits);

    populateWarmupManagerLibrary();
    refreshWorkoutSplitSelector();
    showManagedSplits();
    setSplitManagerStatus(
      `Imported ${payload.splits.length} split${payload.splits.length===1?"":"s"} successfully.`
    );
  }catch(error){
    setSplitManagerStatus(error.message||"Unable to import that JSON file.",true);
  }
}

function normalizeImportedSplitPayload(parsed){
  if(Array.isArray(parsed)){
    return {splits:parsed,customExercises:[]};
  }

  if(parsed && Array.isArray(parsed.splits)){
    return {
      splits:parsed.splits,
      customExercises:Array.isArray(parsed.customExercises)?parsed.customExercises:[]
    };
  }

  if(parsed && parsed.name && Array.isArray(parsed.days)){
    return {splits:[parsed],customExercises:[]};
  }

  throw new Error("Unsupported split JSON format.");
}

function isValidImportedSplit(split){
  if(!split || typeof split!=="object") return false;
  if(typeof split.name!=="string" || !split.name.trim()) return false;
  if(!Array.isArray(split.days) || split.days.length<1 || split.days.length>7) return false;

  return split.days.every(day=>
    day &&
    typeof day==="object" &&
    Array.isArray(day.warmups) &&
    Array.isArray(day.workouts)
  );
}

function importManagedSplits(importedSplits){
  const current=getCustomSplits();
  const builtInIds=new Set(WORKOUT_SPLITS.map(split=>split.id));
  const currentIds=new Set(current.map(split=>split.id));
  const conflicts=importedSplits.filter(split=>
    split.id && (currentIds.has(split.id) || builtInIds.has(split.id))
  );

  let replaceConflicts=true;

  if(conflicts.length){
    replaceConflicts=window.confirm(
      `${conflicts.length} imported split${conflicts.length===1?" has":"s have"} an ID already on this device.\n\n`+
      `Press OK to replace/update those definitions. Press Cancel to import them as separate copies.`
    );
  }

  importedSplits.forEach(raw=>{
    const split=normalizeImportedSplit(raw);
    const conflict=current.findIndex(item=>item.id===split.id);
    const isBuiltIn=builtInIds.has(split.id);

    if((conflict>=0 || isBuiltIn) && !replaceConflicts){
      split.id=makeSplitManagerId();
      split.name=makeUniqueImportedSplitName(split.name,current);
      split.builtInOverride=false;
    }

    const existing=current.findIndex(item=>item.id===split.id);

    if(existing>=0){
      current[existing]=split;
    }else{
      // An imported built-in ID is intentionally stored as a local override.
      current.push(split);
    }
  });

  saveCustomSplits(current);
}

function normalizeImportedSplit(raw){
  const split=deepClone(raw);
  split.id=split.id || makeSplitManagerId();
  split.name=String(split.name||"Imported Split").trim();
  split.createdAt=split.createdAt||Date.now();
  split.updatedAt=Date.now();

  split.days=(split.days||[]).map((day,index)=>({
    id:`day${index+1}`,
    name:String(day.name||`Day ${index+1}`),
    warmups:(day.warmups||[]).map(warmup=>({
      ...warmup,
      id:warmup.id||makeSplitManagerId()
    })),
    workouts:(day.workouts||[]).map(workout=>({
      ...workout,
      id:workout.id||makeSplitManagerId()
    }))
  }));

  return split;
}

function makeUniqueImportedSplitName(base,current){
  const names=new Set(current.map(split=>split.name));
  let candidate=`${base} (Imported)`;
  let counter=2;

  while(names.has(candidate)){
    candidate=`${base} (Imported ${counter++})`;
  }

  return candidate;
}

function importCustomExercises(importedExercises){
  if(!Array.isArray(importedExercises)||!importedExercises.length) return;

  const current=getCustomExerciseLibrary();
  const byId=new Map(current.map(exercise=>[exercise.id,exercise]));

  importedExercises.forEach(raw=>{
    if(!raw || typeof raw!=="object" || !raw.id || !raw.name || !raw.group) return;
    byId.set(raw.id,{...raw,custom:true});
  });

  saveCustomExerciseLibrary([...byId.values()]);
}

function managerDateStamp(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

function renderManagedSplitList(){
  const customSplits=getCustomSplits();
  const builtInIds=new Set(WORKOUT_SPLITS.map(split=>split.id));

  // Any custom split saved with a built-in ID is treated as that built-in's editable override.
  const overrides=new Map(
    customSplits
      .filter(split=>builtInIds.has(split.id))
      .map(split=>[split.id,split])
  );

  const standaloneCustom=customSplits.filter(split=>!builtInIds.has(split.id));
  const entries=[
    ...WORKOUT_SPLITS.map(split=>({
      kind:"builtIn",
      id:split.id,
      name:(overrides.get(split.id)||split).name,
      source:overrides.get(split.id)||split,
      overridden:overrides.has(split.id)
    })),
    ...standaloneCustom.map(split=>({
      kind:"custom",
      id:split.id,
      name:split.name,
      source:split,
      overridden:false
    }))
  ];

  el.managedSplitList.innerHTML="";

  if(!entries.length){
    const empty=document.createElement("div");
    empty.className="managed-empty";
    empty.textContent="No workout splits are available.";
    el.managedSplitList.appendChild(empty);
    return;
  }

  entries.forEach(entry=>{
    const item=document.createElement("div");
    item.className="managed-split-item";

    const info=document.createElement("div");
    info.className="managed-split-info";

    const name=document.createElement("strong");
    name.textContent=entry.name;

    const meta=document.createElement("span");

    if(entry.kind==="builtIn"){
      const dayCount=entry.source.days ? entry.source.days.length : 0;
      meta.textContent=
        `${dayCount} workout day${dayCount===1?"":"s"} · `+
        `${entry.overridden ? "Built-in split · Edited locally" : "Built-in split"}`;
    }else{
      meta.textContent=
        `${entry.source.days.length} workout day${entry.source.days.length===1?"":"s"} · `+
        `Custom split · Last saved ${formatManagerTimestamp(entry.source.updatedAt)}`;
    }

    info.append(name,meta);

    const exportButton=document.createElement("button");
    exportButton.type="button";
    exportButton.className="secondary-button";
    exportButton.textContent="Export";
    exportButton.addEventListener("click",()=>exportManagedSplit(entry.id,entry.kind));

    const txtButton=document.createElement("button");
    txtButton.type="button";
    txtButton.className="secondary-button";
    txtButton.textContent="TXT";
    txtButton.addEventListener("click",()=>{
      let split=null;
      if(entry.kind==="builtIn"){
        const override=getCustomSplits().find(item=>item.id===entry.id);
        const builtIn=WORKOUT_SPLITS.find(item=>item.id===entry.id);
        split=override || (builtIn ? convertBuiltInSplitToManagerDraft(builtIn) : null);
      }else{
        split=getCustomSplits().find(item=>item.id===entry.id)||null;
      }

      if(!split) return;
      downloadTextFile(
        splitToChatGPTText(split),
        `${slugifyManagerName(split.name)||"workout-split"}-${managerDateStamp()}.txt`
      );
      setSplitManagerStatus(`Exported "${split.name}" as ChatGPT-friendly text.`);
    });

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="secondary-button";
    edit.textContent="Edit";
    edit.addEventListener("click",()=>editManagedSplit(entry.id,entry.kind));

    item.append(info,exportButton,txtButton,edit);

    if(entry.kind==="custom"){
      const remove=document.createElement("button");
      remove.type="button";
      remove.className="builder-delete-button managed-delete";
      remove.textContent="🗑";
      remove.title="Delete split";
      remove.setAttribute("aria-label",`Delete ${entry.name}`);
      remove.addEventListener("click",()=>{
        if(!window.confirm(`Delete "${entry.name}"?\n\nThis action cannot be undone.`)) return;
        saveCustomSplits(getCustomSplits().filter(split=>split.id!==entry.id));

        if(el.workoutSplitSelector.value===entry.id){
          el.workoutSplitSelector.value="";
          el.workoutDaySelector.innerHTML='<option value="">Select a workout split first…</option>';
          el.workoutDaySelector.disabled=true;
          el.strengthWorkoutDate.disabled=true;
          clearRenderedWorkout();
        }

        refreshWorkoutSplitSelector();
        renderManagedSplitList();
        setSplitManagerStatus(`Deleted "${entry.name}".`);
      });
      item.appendChild(remove);
    }else if(entry.overridden){
      const reset=document.createElement("button");
      reset.type="button";
      reset.className="builder-delete-button managed-delete";
      reset.textContent="↺";
      reset.title="Restore built-in split";
      reset.setAttribute("aria-label",`Restore built-in ${entry.name}`);
      reset.addEventListener("click",()=>{
        if(!window.confirm(`Restore "${entry.name}" to its built-in version?\n\nYour local edits to this split will be removed.`)) return;
        saveCustomSplits(getCustomSplits().filter(split=>split.id!==entry.id));
        renderManagedSplitList();
        refreshWorkoutSplitSelector();

        if(el.workoutSplitSelector.value===entry.id){
          populateWorkoutDaysForSelectedSplit();
          clearRenderedWorkout();
        }

        setSplitManagerStatus(`Restored "${entry.name}" to the built-in version.`);
      });
      item.appendChild(reset);
    }

    el.managedSplitList.appendChild(item);
  });
}

function editManagedSplit(id,kind){
  if(kind==="custom"){
    const split=getCustomSplits().find(item=>item.id===id);
    if(!split) return;
    openManagedSplitEditor(split);
    return;
  }

  const override=getCustomSplits().find(item=>item.id===id);
  if(override){
    openManagedSplitEditor(override);
    return;
  }

  const builtIn=WORKOUT_SPLITS.find(split=>split.id===id);
  if(!builtIn) return;

  openManagedSplitEditor(convertBuiltInSplitToManagerDraft(builtIn));
}

function openManagedSplitEditor(split){
  splitEditorDraft=deepClone(split);
  splitEditorCurrentDayIndex=0;

  el.splitListView.hidden=true;
  el.splitEditorView.hidden=false;
  el.splitEditorName.value=splitEditorDraft.name;
  el.splitEditorDayCount.value=String(splitEditorDraft.days.length);
  el.splitDayEditor.hidden=false;

  renderSplitDayEditor();
  setSplitManagerStatus(`Editing "${splitEditorDraft.name}".`);
}

function convertBuiltInSplitToManagerDraft(split){
  return {
    id:split.id,
    name:split.name,
    builtInOverride:true,
    createdAt:Date.now(),
    updatedAt:Date.now(),
    days:split.days.map((day,index)=>({
      id:day.id || `day${index+1}`,
      name:String(day.label||`Day ${index+1}`).replace(/^Day\s+\d+\s*[-—]\s*/,""),
      warmups:(day.warmups||[]).map(warmup=>{
        const name=Array.isArray(warmup)?warmup[0]:warmup.name;
        const display=Array.isArray(warmup)?warmup[1]:(warmup.display||"");
        return {
          id:makeSplitManagerId(),
          libraryId:slugifyManagerName(name),
          name,
          volumeType:"custom",
          sets:null,
          value:null,
          custom:display,
          display
        };
      }),
      workouts:(day.exercises||[]).map(exercise=>convertBuiltInExerciseToManagerWorkout(exercise))
    }))
  };
}

function convertBuiltInExerciseToManagerWorkout(exercise){
  const candidateIds=[
    exercise.trackingId,
    exercise.id,
    ...(exercise.options||[]).flatMap(option=>[option.trackingId,option.id])
  ].filter(Boolean);

  const library=getManagerExerciseLibrary();
  let match=library.find(item=>candidateIds.includes(item.id));

  if(!match){
    match=library.find(item=>
      normalizeManagerExerciseName(item.name)===normalizeManagerExerciseName(exercise.name)
    );
  }

  const range=parseManagerPrescription(exercise.prescription);
  const id=match ? match.id : (exercise.id||`custom-${slugifyManagerName(exercise.name||"exercise")}`);

  return {
    id:makeSplitManagerId(),
    exerciseId:id,
    name:match ? match.name : (exercise.name||"Exercise"),
    type:match ? match.group : "Compound",
    sets:range.sets,
    rangeMin:range.min,
    rangeMax:range.max,
    unit:match ? (match.unit||"reps") : "reps",
    noVolume:match ? Boolean(match.noVolume) : false,
    tracksWeight:match ? Boolean(match.tracksWeight) : true,
    assistanceToggle:match ? Boolean(match.assistanceToggle) : false,
    variants:match && Array.isArray(match.variants) ? match.variants.slice() : [],
    choiceLabel:match ? (match.choiceLabel||null) : null,
    side:match ? Boolean(match.side) : false,
    sideVariant:match ? (match.sideVariant||null) : null,
    display:range.display || (exercise.prescription||"No prescribed volume")
  };
}

function normalizeManagerExerciseName(value){
  return String(value||"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function parseManagerPrescription(value){
  const text=String(value||"");
  const match=text.match(/(\d+)\s*×\s*(\d+)\s*[–-]\s*(\d+)/);

  if(match){
    return {
      sets:Number(match[1]),
      min:Number(match[2]),
      max:Number(match[3]),
      display:`${match[1]}×${match[2]}–${match[3]}`
    };
  }

  const workingSets=text.match(/(\d+)\s+working\s+sets/i);
  if(workingSets){
    return {
      sets:Number(workingSets[1]),
      min:1,
      max:1,
      display:text
    };
  }

  return {sets:1,min:1,max:1,display:text||"1×1–1"};
}

function ensureSplitDraftExists(){if(!splitEditorDraft)splitEditorDraft={id:makeSplitManagerId(),name:el.splitEditorName.value||"",days:[],createdAt:Date.now(),updatedAt:Date.now()}}
function resizeSplitDraftDays(count){
  ensureSplitDraftExists();
  while(splitEditorDraft.days.length<count){const n=splitEditorDraft.days.length+1;splitEditorDraft.days.push({id:`day${n}`,name:`Day ${n}`,warmups:[],workouts:[]})}
  if(splitEditorDraft.days.length>count)splitEditorDraft.days=splitEditorDraft.days.slice(0,count);
  splitEditorDraft.days.forEach((d,i)=>{d.id=`day${i+1}`;if(!d.name)d.name=`Day ${i+1}`});
}

function renderSplitDayEditor(){
  if(!splitEditorDraft||!splitEditorDraft.days.length){el.splitDayEditor.hidden=true;return}
  el.splitDayEditor.hidden=false;const day=splitEditorDraft.days[splitEditorCurrentDayIndex];
  el.splitDaySelector.innerHTML="";
  splitEditorDraft.days.forEach((d,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`Day ${i+1}${d.name&&d.name!==`Day ${i+1}`?" — "+d.name:""}`;o.selected=i===splitEditorCurrentDayIndex;el.splitDaySelector.appendChild(o)});
  el.splitDayName.value=day.name||`Day ${splitEditorCurrentDayIndex+1}`;
  el.previousSplitDayButton.disabled=splitEditorCurrentDayIndex===0;
  el.nextSplitDayButton.disabled=splitEditorCurrentDayIndex===splitEditorDraft.days.length-1;
  renderSplitDayOrder();
  resetSplitBuilderForms();
  renderSavedWarmups();
  renderSavedWorkouts();
}

function renderSplitDayOrder(){
  el.splitDayOrderList.innerHTML="";
  if(!splitEditorDraft) return;

  splitEditorDraft.days.forEach((day,index)=>{
    const item=document.createElement("div");
    item.className="split-day-order-item";
    item.draggable=true;
    item.dataset.index=String(index);

    const handle=document.createElement("span");
    handle.className="drag-handle";
    handle.textContent="⋮⋮";
    handle.title="Drag to reorder";

    const label=document.createElement("span");
    label.className="day-label";
    label.textContent=`Day ${index+1}: ${day.name || `Day ${index+1}`}`;

    const up=createReorderButton("↑","Move day earlier",()=>moveSplitDay(index,index-1));
    const down=createReorderButton("↓","Move day later",()=>moveSplitDay(index,index+1));

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="builder-edit-button";
    edit.textContent="✎";
    edit.title="Edit this day";
    edit.addEventListener("click",()=>{
      persistCurrentSplitDayName();
      splitEditorCurrentDayIndex=index;
      renderSplitDayEditor();
    });

    item.append(handle,label,up,down,edit);
    addDragReorderHandlers(item,el.splitDayOrderList,index,(from,to)=>moveSplitDay(from,to));
    el.splitDayOrderList.appendChild(item);
  });
}

function moveSplitDay(from,to){
  if(!splitEditorDraft || to<0 || to>=splitEditorDraft.days.length || from===to) return;
  persistCurrentSplitDayName();

  const currentDay=splitEditorDraft.days[splitEditorCurrentDayIndex];
  const [moved]=splitEditorDraft.days.splice(from,1);
  splitEditorDraft.days.splice(to,0,moved);

  splitEditorDraft.days.forEach((day,index)=>{day.id=`day${index+1}`});
  splitEditorCurrentDayIndex=splitEditorDraft.days.indexOf(currentDay);
  if(splitEditorCurrentDayIndex<0) splitEditorCurrentDayIndex=0;
  renderSplitDayEditor();
}

function createReorderButton(text,title,handler){
  const button=document.createElement("button");
  button.type="button";
  button.className="reorder-button";
  button.textContent=text;
  button.title=title;
  button.addEventListener("click",event=>{
    event.stopPropagation();
    handler();
  });
  return button;
}

function addDragReorderHandlers(item,container,index,onMove){
  item.addEventListener("dragstart",event=>{
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",String(index));
  });

  item.addEventListener("dragend",()=>item.classList.remove("dragging"));

  item.addEventListener("dragover",event=>{
    event.preventDefault();
    event.dataTransfer.dropEffect="move";
  });

  item.addEventListener("drop",event=>{
    event.preventDefault();
    const from=Number(event.dataTransfer.getData("text/plain"));
    const to=Number(item.dataset.index);
    if(Number.isInteger(from)&&Number.isInteger(to)) onMove(from,to);
  });
}

function persistCurrentSplitDayName(){if(!splitEditorDraft||!splitEditorDraft.days.length)return;splitEditorDraft.days[splitEditorCurrentDayIndex].name=el.splitDayName.value.trim()||`Day ${splitEditorCurrentDayIndex+1}`}

function buildManagerWarmupLibrary(){
  const map=new Map();WORKOUT_SPLITS.forEach(s=>s.days.forEach(d=>d.warmups.forEach(w=>{const n=Array.isArray(w)?w[0]:w.name;if(n&&!map.has(n))map.set(n,{id:slugifyManagerName(n),name:n})})));
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function populateWarmupManagerLibrary(){
  el.warmupLibrarySelector.innerHTML='<option value="">Select a warm-up…</option>';
  buildManagerWarmupLibrary().forEach(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=x.name;o.dataset.name=x.name;el.warmupLibrarySelector.appendChild(o)});
}
function updateWarmupVolumeInputs(){
  const t=el.warmupVolumeType.value;el.warmupSetsWrap.hidden=t!=="setsReps";el.warmupRepsWrap.hidden=t==="custom";el.warmupCustomWrap.hidden=t!=="custom";
  el.warmupRepsLabel.textContent=t==="repsSide"?"Reps / side":t==="seconds"?"Seconds":t==="secondsSide"?"Seconds / side":t==="stepsDirection"?"Steps / direction":"Reps";
}
function saveWarmupToDraftDay(){
  el.warmupBuilderMessage.textContent="";
  const day=getCurrentDraftDay();
  if(!day) return;

  const selected=el.warmupLibrarySelector.selectedOptions[0];
  if(!selected||!selected.value){
    el.warmupBuilderMessage.textContent="Select a warm-up.";
    return;
  }

  const type=el.warmupVolumeType.value;
  let display="",sets=null,value=null,custom=null;

  if(type==="custom"){
    custom=el.warmupCustomVolume.value.trim();
    if(!custom){
      el.warmupBuilderMessage.textContent="Enter the custom warm-up volume.";
      return;
    }
    display=custom;
  }else{
    value=Number(el.warmupReps.value);
    if(!Number.isInteger(value)||value<1){
      el.warmupBuilderMessage.textContent="Enter a valid volume value.";
      return;
    }

    if(type==="setsReps"){
      sets=Number(el.warmupSets.value);
      if(!Number.isInteger(sets)||sets<1){
        el.warmupBuilderMessage.textContent="Enter a valid number of sets.";
        return;
      }
      display=`${sets}×${value}`;
    }else if(type==="reps") display=`${value} reps`;
    else if(type==="repsSide") display=`${value}/side`;
    else if(type==="seconds") display=`${value} sec`;
    else if(type==="secondsSide") display=`${value} sec/side`;
    else display=`${value} steps each direction`;
  }

  const payload={
    id:editingWarmupId || makeSplitManagerId(),
    libraryId:selected.value,
    name:selected.dataset.name||selected.textContent,
    volumeType:type,
    sets,value,custom,display
  };

  if(editingWarmupId){
    const i=day.warmups.findIndex(item=>item.id===editingWarmupId);
    if(i>=0) day.warmups[i]=payload;
  }else{
    day.warmups.push(payload);
  }

  editingWarmupId=null;
  el.saveWarmupButton.textContent="Save Warm-Up";
  el.warmupLibrarySelector.value="";
  el.warmupSets.value="";
  el.warmupReps.value="";
  el.warmupCustomVolume.value="";
  renderSavedWarmups();
}

function renderSavedWarmups(){
  const day=getCurrentDraftDay();
  el.savedWarmupList.innerHTML="";

  if(!day||!day.warmups.length){
    const empty=document.createElement("div");
    empty.className="managed-empty";
    empty.textContent="No warm-ups saved for this day.";
    el.savedWarmupList.appendChild(empty);
    return;
  }

  day.warmups.forEach((item,index)=>{
    const row=document.createElement("div");
    row.className="builder-saved-item";
    row.draggable=true;
    row.dataset.index=String(index);
    if(editingWarmupId===item.id) row.classList.add("builder-editing");

    const copy=document.createElement("div");
    copy.className="builder-saved-copy";
    copy.innerHTML=`<strong><span class="drag-handle">⋮⋮</span> ${escapeHtml(item.name)}</strong><span>${escapeHtml(item.display)}</span>`;

    const actions=document.createElement("div");
    actions.className="builder-item-actions";

    actions.append(
      createReorderButton("↑","Move warm-up earlier",()=>moveDraftItem("warmups",index,index-1)),
      createReorderButton("↓","Move warm-up later",()=>moveDraftItem("warmups",index,index+1))
    );

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="builder-edit-button";
    edit.textContent="✎";
    edit.title="Edit warm-up";
    edit.addEventListener("click",()=>loadWarmupForEditing(item));
    actions.appendChild(edit);

    const del=document.createElement("button");
    del.type="button";
    del.className="builder-delete-button";
    del.textContent="🗑";
    del.title="Remove warm-up";
    del.addEventListener("click",()=>{
      day.warmups=day.warmups.filter(entry=>entry.id!==item.id);
      if(editingWarmupId===item.id){
        editingWarmupId=null;
        el.saveWarmupButton.textContent="Save Warm-Up";
      }
      renderSavedWarmups();
    });
    actions.appendChild(del);

    row.append(copy,actions);
    addDragReorderHandlers(row,el.savedWarmupList,index,(from,to)=>moveDraftItem("warmups",from,to));
    el.savedWarmupList.appendChild(row);
  });
}

function loadWarmupForEditing(item){
  editingWarmupId=item.id;
  el.warmupLibrarySelector.value=item.libraryId || "";
  el.warmupVolumeType.value=item.volumeType || "custom";
  updateWarmupVolumeInputs();
  el.warmupSets.value=item.sets ?? "";
  el.warmupReps.value=item.value ?? "";
  el.warmupCustomVolume.value=item.custom || (item.volumeType==="custom"?item.display:"");
  el.saveWarmupButton.textContent="Save Warm-Up Changes";
  renderSavedWarmups();
}

function moveDraftItem(collection,from,to){
  const day=getCurrentDraftDay();
  if(!day || !Array.isArray(day[collection]) || to<0 || to>=day[collection].length || from===to) return;
  const [moved]=day[collection].splice(from,1);
  day[collection].splice(to,0,moved);
  if(collection==="warmups") renderSavedWarmups();
  else renderSavedWorkouts();
}

function buildManagerExerciseLibrary(){
  return getManagerExerciseLibrary().map(exercise=>({
    ...exercise,
    muscleGroups:exercise.group==="Cardio"?["Cardio"]:[exercise.group],
    compound:exercise.group==="Compound"
  }));
}

function isManagerCompoundExercise(exercise){
  return exercise.group==="Compound";
}

function managerExerciseUnit(exercise){
  return exercise.unit || "reps";
}

function populateSplitWorkoutOptions(){
  const type=el.splitWorkoutType.value;
  el.splitWorkoutExercise.innerHTML="";

  const placeholder=document.createElement("option");
  placeholder.value="";

  if(!type){
    placeholder.textContent="Select workout type first…";
    el.splitWorkoutExercise.disabled=true;
    el.splitWorkoutExercise.appendChild(placeholder);
    updateSplitWorkoutVolumeUnit();
    return;
  }

  placeholder.textContent="Select a workout…";
  el.splitWorkoutExercise.appendChild(placeholder);
  el.splitWorkoutExercise.disabled=false;

  getManagerExerciseLibrary()
    .filter(exercise=>exercise.group===type)
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(exercise=>{
      const option=document.createElement("option");
      option.value=exercise.id;
      option.textContent=exercise.name;
      option.dataset.unit=exercise.unit || "reps";
      option.dataset.noVolume=exercise.noVolume ? "true" : "false";
      el.splitWorkoutExercise.appendChild(option);
    });

  updateSplitWorkoutVolumeUnit();
}

function getSelectedManagerExercise(){
  const id=el.splitWorkoutExercise.value;
  return getManagerExerciseLibrary().find(exercise=>exercise.id===id) || null;
}

function updateSplitWorkoutVolumeUnit(){
  const exercise=getSelectedManagerExercise();
  const noVolume=Boolean(exercise&&exercise.noVolume);
  const unit=exercise ? (exercise.unit||"reps") : "reps";

  el.splitWorkoutSets.closest("label").hidden=noVolume;
  el.splitWorkoutMin.closest("label").hidden=noVolume;
  el.splitWorkoutMax.closest("label").hidden=noVolume;

  if(noVolume){
    el.splitWorkoutUnitHint.textContent="This cardio workout does not use prescribed sets or duration.";
  }else if(unit==="seconds"){
    el.splitWorkoutMinLabel.textContent="Lower time bound (sec)";
    el.splitWorkoutMaxLabel.textContent="Upper time bound (sec)";
    el.splitWorkoutUnitHint.textContent="Volume will be displayed as sets × seconds range.";
  }else{
    el.splitWorkoutMinLabel.textContent="Lower rep bound";
    el.splitWorkoutMaxLabel.textContent="Upper rep bound";
    el.splitWorkoutUnitHint.textContent="Volume will be displayed as sets × rep range.";
  }
}

function saveWorkoutToDraftDay(){
  el.workoutBuilderMessage.textContent="";
  const day=getCurrentDraftDay();
  if(!day) return;

  const type=el.splitWorkoutType.value;
  const exercise=getSelectedManagerExercise();

  if(!type||!exercise){
    el.workoutBuilderMessage.textContent="Choose a workout type and exercise.";
    return;
  }

  let sets=null,min=null,max=null,display="No prescribed volume";

  if(!exercise.noVolume){
    sets=Number(el.splitWorkoutSets.value);
    min=Number(el.splitWorkoutMin.value);
    max=Number(el.splitWorkoutMax.value);

    if(!Number.isInteger(sets)||sets<1){
      el.workoutBuilderMessage.textContent="Enter a valid number of sets.";
      return;
    }
    if(!Number.isFinite(min)||min<1||!Number.isFinite(max)||max<min){
      el.workoutBuilderMessage.textContent="Enter a valid lower and upper range.";
      return;
    }

    const suffix=exercise.unit==="seconds"?" sec":"";
    display=`${sets}×${formatManagerNumber(min)}–${formatManagerNumber(max)}${suffix}`;
  }

  const payload={
    id:editingWorkoutId || makeSplitManagerId(),
    exerciseId:exercise.id,
    name:exercise.name,
    type:exercise.group,
    sets,
    rangeMin:min,
    rangeMax:max,
    unit:exercise.unit||"reps",
    noVolume:Boolean(exercise.noVolume),
    tracksWeight:Boolean(exercise.tracksWeight),
    assistanceToggle:Boolean(exercise.assistanceToggle),
    variants:Array.isArray(exercise.variants)?exercise.variants.slice():[],
    choiceLabel:exercise.choiceLabel||null,
    side:Boolean(exercise.side),
    sideVariant:exercise.sideVariant||null,
    display
  };

  if(editingWorkoutId){
    const i=day.workouts.findIndex(item=>item.id===editingWorkoutId);
    if(i>=0) day.workouts[i]=payload;
  }else{
    day.workouts.push(payload);
  }

  editingWorkoutId=null;
  el.saveWorkoutButton.textContent="Save Workout";
  el.splitWorkoutSets.value="";
  el.splitWorkoutMin.value="";
  el.splitWorkoutMax.value="";
  renderSavedWorkouts();
}

function renderSavedWorkouts(){
  const day=getCurrentDraftDay();
  el.savedWorkoutList.innerHTML="";

  if(!day||!day.workouts.length){
    const empty=document.createElement("div");
    empty.className="managed-empty";
    empty.textContent="No workouts saved for this day.";
    el.savedWorkoutList.appendChild(empty);
    return;
  }

  day.workouts.forEach((item,index)=>{
    const row=document.createElement("div");
    row.className="builder-saved-item";
    row.draggable=true;
    row.dataset.index=String(index);
    if(editingWorkoutId===item.id) row.classList.add("builder-editing");

    const copy=document.createElement("div");
    copy.className="builder-saved-copy";
    const variantText=item.variants&&item.variants.length?` · Options: ${item.variants.join(", ")}`:"";
    copy.innerHTML=`<strong><span class="drag-handle">⋮⋮</span> ${escapeHtml(item.name)}</strong><span>${escapeHtml(item.display)} · ${escapeHtml(item.type)}${escapeHtml(variantText)}</span>`;

    const actions=document.createElement("div");
    actions.className="builder-item-actions";

    actions.append(
      createReorderButton("↑","Move workout earlier",()=>moveDraftItem("workouts",index,index-1)),
      createReorderButton("↓","Move workout later",()=>moveDraftItem("workouts",index,index+1))
    );

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="builder-edit-button";
    edit.textContent="✎";
    edit.title="Edit workout";
    edit.addEventListener("click",()=>loadWorkoutForEditing(item));
    actions.appendChild(edit);

    const del=document.createElement("button");
    del.type="button";
    del.className="builder-delete-button";
    del.textContent="🗑";
    del.title="Remove workout";
    del.addEventListener("click",()=>{
      day.workouts=day.workouts.filter(entry=>entry.id!==item.id);
      if(editingWorkoutId===item.id){
        editingWorkoutId=null;
        el.saveWorkoutButton.textContent="Save Workout";
      }
      renderSavedWorkouts();
    });
    actions.appendChild(del);

    row.append(copy,actions);
    addDragReorderHandlers(row,el.savedWorkoutList,index,(from,to)=>moveDraftItem("workouts",from,to));
    el.savedWorkoutList.appendChild(row);
  });
}

function loadWorkoutForEditing(item){
  editingWorkoutId=item.id;
  el.splitWorkoutType.value=item.type || "";
  populateSplitWorkoutOptions();
  el.splitWorkoutExercise.value=item.exerciseId || "";
  updateSplitWorkoutVolumeUnit();
  el.splitWorkoutSets.value=item.sets ?? "";
  el.splitWorkoutMin.value=item.rangeMin ?? "";
  el.splitWorkoutMax.value=item.rangeMax ?? "";
  el.saveWorkoutButton.textContent="Save Workout Changes";
  renderSavedWorkouts();
}

function saveCurrentSplitDraft(){
  ensureSplitDraftExists();persistCurrentSplitDayName();const name=el.splitEditorName.value.trim(),count=Number(el.splitEditorDayCount.value);
  if(!name){setSplitManagerStatus("Enter a split name before saving.",true);el.splitEditorName.focus();return}
  if(!Number.isInteger(count)||count<1||count>7||!splitEditorDraft.days.length){setSplitManagerStatus("Choose between 1 and 7 workout days before saving.",true);return}
  splitEditorDraft.name=name;splitEditorDraft.updatedAt=Date.now();const splits=getCustomSplits(),i=splits.findIndex(x=>x.id===splitEditorDraft.id);
  if(i>=0)splits[i]=deepClone(splitEditorDraft);else splits.push(deepClone(splitEditorDraft));
  saveCustomSplits(splits);

  const savedId=splitEditorDraft.id;
  refreshWorkoutSplitSelector();

  // Keep the newly saved/edited split immediately available in Workout Logging.
  el.workoutSplitSelector.value=savedId;
  populateWorkoutDaysForSelectedSplit();
  clearRenderedWorkout();
  el.strengthWorkoutDate.disabled=false;
  el.workoutDaySelector.disabled=false;

  setSplitManagerStatus(`Saved "${name}". It is now available in Workout Logging.`);
}
function getCurrentDraftDay(){return splitEditorDraft&&splitEditorDraft.days.length?splitEditorDraft.days[splitEditorCurrentDayIndex]||null:null}
function getCustomSplits(){try{const d=JSON.parse(appStorage.getItem(CUSTOM_SPLITS_STORAGE_KEY)||"[]");return Array.isArray(d)?d:[]}catch{return[]}}
function saveCustomSplits(s){appStorage.setItem(CUSTOM_SPLITS_STORAGE_KEY,JSON.stringify(s))}
function resetSplitBuilderForms(){
  editingWarmupId=null;
  editingWorkoutId=null;
  el.saveWarmupButton.textContent="Save Warm-Up";
  el.saveWorkoutButton.textContent="Save Workout";
  el.warmupLibrarySelector.value="";el.warmupVolumeType.value="setsReps";el.warmupSets.value="";el.warmupReps.value="";el.warmupCustomVolume.value="";el.warmupBuilderMessage.textContent="";updateWarmupVolumeInputs();
  el.splitWorkoutType.value="";el.splitWorkoutExercise.innerHTML='<option value="">Select workout type first…</option>';el.splitWorkoutExercise.disabled=true;el.splitWorkoutSets.value="";el.splitWorkoutMin.value="";el.splitWorkoutMax.value="";el.workoutBuilderMessage.textContent="";el.customWorkoutMessage.textContent="";updateSplitWorkoutVolumeUnit();
}
function setSplitManagerStatus(m,e=false){el.splitManagerStatus.textContent=m;el.splitManagerStatus.classList.toggle("error",e)}
function clearSplitManagerStatus(){setSplitManagerStatus("")}
function deepClone(v){return JSON.parse(JSON.stringify(v))}
function makeSplitManagerId(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function slugifyManagerName(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function formatManagerTimestamp(t){return t?new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(t)):"unknown date"}
function formatManagerNumber(v){return Number.isInteger(Number(v))?String(Number(v)):String(Number(v))}

function refreshWorkoutSplitSelector(){
  const previous=el.workoutSplitSelector.value;
  const builtInIds=new Set(WORKOUT_SPLITS.map(split=>split.id));

  const entries=[
    ...WORKOUT_SPLITS.map(split=>{
      const override=getCustomSplits().find(item=>item.id===split.id);
      return {
        id:split.id,
        name:override ? override.name : split.name
      };
    }),
    ...getCustomSplits()
      .filter(split=>!builtInIds.has(split.id))
      .map(split=>({id:split.id,name:split.name}))
  ];

  el.workoutSplitSelector.innerHTML='<option value="">Select a workout split…</option>';

  entries.forEach(split=>{
    const option=document.createElement("option");
    option.value=split.id;
    option.textContent=split.name;
    el.workoutSplitSelector.appendChild(option);
  });

  if(entries.some(split=>split.id===previous)){
    el.workoutSplitSelector.value=previous;
  }
}

function setupWorkoutLogging(){
  refreshWorkoutSplitSelector();

  el.strengthWorkoutDate.value=formatDateForInput(new Date());

  el.workoutSplitSelector.addEventListener("change",()=>{
    populateWorkoutDaysForSelectedSplit();
    clearRenderedWorkout();

    const hasSplit=Boolean(getSelectedWorkoutSplit());
    el.strengthWorkoutDate.disabled=!hasSplit;
    el.workoutDaySelector.disabled=!hasSplit;

    if(hasSplit){
      if(typeof el.strengthWorkoutDate.showPicker==="function"){
        try{el.strengthWorkoutDate.showPicker()}catch{}
      }else{
        el.strengthWorkoutDate.focus();
      }
    }
  });

  el.strengthWorkoutDate.addEventListener("change",()=>{
    syncCommuteDateFromWorkoutDate();
    if(el.workoutDaySelector.value) renderSelectedWorkoutDay();
  });

  el.workoutDaySelector.addEventListener("change",renderSelectedWorkoutDay);
}

function populateWorkoutDaysForSelectedSplit(){
  const split=getSelectedWorkoutSplit();

  el.workoutDaySelector.innerHTML="";

  const placeholder=document.createElement("option");
  placeholder.value="";

  if(!split){
    placeholder.textContent="Select a workout split first…";
    el.workoutDaySelector.appendChild(placeholder);
    return;
  }

  placeholder.textContent="Select a workout day…";
  el.workoutDaySelector.appendChild(placeholder);

  split.days.forEach(day=>{
    const option=document.createElement("option");
    option.value=day.id;
    option.textContent=day.label;
    el.workoutDaySelector.appendChild(option);
  });
}

function clearRenderedWorkout(){
  el.selectedDayDescription.hidden=true;
  if(el.gymCompatibilityCard) el.gymCompatibilityCard.hidden=true;
  el.inlineCyclingContainer.hidden=true;
  el.warmupContainer.hidden=true;
  el.workingSetsContainer.hidden=true;
  el.warmupList.innerHTML="";
  el.workingExerciseList.innerHTML="";
  el.workoutLoggingMessage.hidden=true;
}

const TRACKING_MUSCLE_GROUPS=[
  "Cardio","Compound","Back","Biceps","Chest","Shoulders","Triceps","Forearms",
  "Quadriceps","Hamstrings","Glutes","Calves","Core"
];

const CENTRAL_TRACKING_ALIASES={
  "cycling":[],
  "treadmill":[],

  "flat-press":["machine-chest-press","flat-bench-press"],
  "incline-press":["incline-dumbbell-press","incline-machine-press","low-incline-dumbbell-press","low-incline-smith-machine-press","low-incline-barbell-press"],
  "barbell-squat":["high-bar-barbell-squat"],
  "smith-machine-squat":["deep-smith-machine-squat","smith-machine-squat"],
  "deadlift":[],
  "romanian-deadlift":["romanian-deadlift"],
  "shoulder-press":["dumbbell-shoulder-press","machine-shoulder-press","shoulder-press-machine"],
  "pull-ups":["pull-up","wide-grip-pull-up","assisted-wide-grip-pull-up","assisted-pull-up"],

  "chest-supported-row":["chest-supported-row","wide-grip-chest-supported-row","chest-supported-t-bar-row","chest-supported-or-seated-cable-row"],
  "dumbbell-shrug":["dumbbell-shrug"],
  "lat-pulldown":["lat-pulldown","neutral-grip-lat-pulldown","half-kneeling-one-arm-lat-pulldown","lat-pulldown-or-pull-up"],
  "reverse-pec-deck":["reverse-pec-deck","sideways-one-arm-rear-delt-fly","reverse-cable-crossover","single-arm-rear-delt-fly"],
  "seated-cable-row":["seated-cable-row","neutral-grip-cable-row","wide-grip-seated-cable-row"],
  "erector-biased-hyperextension":["erector-biased-hyperextension","erector-biased-weighted-hyperextension"],

  "bayesian-cable-curl":["face-away-bayesian-cable-curl"],
  "hammer-preacher-curl":["preacher-hammer-curl"],
  "supinated-preacher-curl":["supinated-machine-preacher-curl","supinated-cable-preacher-curl"],

  "pec-fly":["seated-cable-pec-fly","cable-pec-fly","pec-deck","pec-deck-fly"],
  "chest-biased-dip":["chest-biased-machine-dip","weighted-chest-biased-dip"],
  "lateral-raises":["cable-lateral-raise","cable-incline-y-raise"],

  "cable-pushdown":["cable-triceps-pushdown"],
  "overhead-cable-extension":["overhead-cable-triceps-extension"],
  "tricep-biased-dip":[],

  "wrist-curl":["wrist-curl","dumbbell-wrist-curl"],
  "wrist-extension":["wrist-extension","dumbbell-wrist-extension"],

  "bulgarian-split-squat":["bulgarian-split-squat"],
  "hack-squat":["hack-squat"],
  "leg-extension":["leg-extension"],
  "leg-press":["leg-press"],

  "hamstring-curl":["hamstring-curl","seated-hamstring-curl"],

  "glute-bridge":["glute-bridge"],
  "glute-biased-hyperextension":["glute-biased-rounded-back-hyperextension"],
  "hip-abduction":["hip-abduction-machine"],
  "hip-adduction":["hip-adduction-machine"],

  "calf-raises":["standing-calf-raise"],

  "crunches":["machine-crunch","cable-crunch","machine-or-cable-crunch"],
  "cable-woodchop":["cable-woodchop"],
  "ab-wheel-rollout":["ab-wheel-rollout"],
  "copenhagen-plank":["copenhagen-plank"],
  "dragon-flag-progression":["dragon-flag-progression"]
};

function canonicalExerciseIdForStorageId(exerciseId){
  if(!exerciseId) return exerciseId;

  for(const [canonical,aliases] of Object.entries(CENTRAL_TRACKING_ALIASES)){
    if(exerciseId===canonical || (aliases||[]).includes(exerciseId)){
      return canonical;
    }
  }

  return exerciseId;
}

function migrateLegacyWorkoutLogAliases(){
  const markerKey="workoutLogSchemaMigration:v26.7";
  const {copied}=workoutHistory.migrateAll();
  appStorage.setItem(markerKey,"done-legacy-keys-preserved");
  if(copied) console.info(`Copied ${copied} legacy workout logs into canonical exercise storage.`);
}



const CENTRAL_TRACKING_VARIANT_NAMES={
  "wide-grip-pull-up":"Wide Grip",
  "assisted-wide-grip-pull-up":"Wide Grip · Assisted",
  "assisted-pull-up":"Assisted",
  "neutral-grip-lat-pulldown":"Neutral Grip",
  "half-kneeling-one-arm-lat-pulldown":"Half-Kneeling One-Arm",
  "neutral-grip-cable-row":"Neutral Grip",
  "wide-grip-seated-cable-row":"Wide Grip",
  "wide-grip-chest-supported-row":"Wide Grip",
  "sideways-one-arm-rear-delt-fly":"One Arm",
  "single-arm-rear-delt-fly":"One Arm",
  "reverse-cable-crossover":"Two Arm",
  "dumbbell-shoulder-press":"Dumbbell",
  "machine-shoulder-press":"Machine",
  "shoulder-press-machine":"Machine",
  "supinated-machine-preacher-curl":"Machine",
  "supinated-cable-preacher-curl":"Cable",
  "cable-pec-fly":"Cable",
  "pec-deck":"Pec Deck",
  "pec-deck-fly":"Pec Deck",
  "standing-calf-raise":"Standing",
  "seated-hamstring-curl":"Seated",
  "machine-crunch":"Machine",
  "cable-crunch":"Cable"
};

const workoutHistory=window.createWorkoutHistoryStore({
  storage:appStorage,
  aliases:CENTRAL_TRACKING_ALIASES,
  variantNames:CENTRAL_TRACKING_VARIANT_NAMES
});

let trackingViewerMode="self";
let publicAdminProgress={uid:null,displayName:"James",data:{}};

function isPublicTrackingView(){
  return trackingViewerMode==="james";
}

function parseTrackingStoredValue(key){
  if(!isPublicTrackingView()){
    return appStorage.getItem(key);
  }

  const value=publicAdminProgress.data?.[key];
  return value===undefined ? null : value;
}

function getWorkoutHistoryForTracking(exerciseId){
  if(!isPublicTrackingView()) return workoutHistory.read(exerciseId);

  const data=publicAdminProgress.data||{};
  const keys=Object.keys(data);
  const readOnlyStorage={
    get length(){return keys.length},
    key:index=>keys[index]??null,
    getItem:key=>data[key]===undefined ? null : data[key],
    setItem:()=>{throw new Error("Public workout history is read-only.")}
  };
  return window.createWorkoutHistoryStore({
    storage:readOnlyStorage,
    aliases:CENTRAL_TRACKING_ALIASES,
    variantNames:CENTRAL_TRACKING_VARIANT_NAMES
  }).read(exerciseId);
}

function getTrackingCyclingLogs(){
  try{
    const data=JSON.parse(parseTrackingStoredValue("cyclingActivityLogs")||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function getPublicCustomExerciseLibrary(){
  try{
    const data=JSON.parse(parseTrackingStoredValue(CUSTOM_EXERCISES_STORAGE_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function getTrackingExerciseLibrary(){
  if(!isPublicTrackingView()) return getManagerExerciseLibrary();

  const builtIns=MANAGER_EXERCISE_LIBRARY.map(exercise=>({
    ...exercise,
    ...(BUILT_IN_EXERCISE_OVERRIDES[exercise.id]||{}),
    id:exercise.id,
    custom:false
  }));

  return [...builtIns,...getPublicCustomExerciseLibrary()];
}

async function toggleJamesProgressView(){
  if(isPublicTrackingView()){
    trackingViewerMode="self";
    publicAdminProgress={uid:null,displayName:"James",data:{}};
    el.viewJamesProgressButton.textContent="See how James is doing";
    el.publicProgressBanner.hidden=true;
    resetTrackingForViewerChange();
    return;
  }

  if(typeof window.loadPublishedAdminProgress!=="function"){
    el.trackingResults.innerHTML='<div class="empty-state">James\'s public progress is not available yet.</div>';
    return;
  }

  const original=el.viewJamesProgressButton.textContent;
  el.viewJamesProgressButton.disabled=true;
  el.viewJamesProgressButton.textContent="Loading James…";

  try{
    const result=await window.loadPublishedAdminProgress();

    if(!result){
      el.trackingResults.innerHTML='<div class="empty-state">James has not published workout progress yet. Ask him to open the latest app while online once.</div>';
      return;
    }

    publicAdminProgress=result;
    trackingViewerMode="james";

    const displayName=result.displayName||"James";
    el.publicProgressName.textContent=displayName;
    el.viewJamesProgressButton.textContent="Back to my progress";
    el.publicProgressBanner.hidden=false;

    resetTrackingForViewerChange();
  }catch(error){
    console.error(error);
    el.trackingResults.innerHTML='<div class="empty-state">James\'s workout progress could not be loaded. Check your connection and Firestore rules.</div>';
  }finally{
    el.viewJamesProgressButton.disabled=false;
    if(!isPublicTrackingView()) el.viewJamesProgressButton.textContent=original;
  }
}

function resetTrackingForViewerChange(){
  destroyTrackingCharts();
  el.trackingMuscleGroup.value="";
  el.trackingExerciseSelector.innerHTML='<option value="">Select a muscle group first…</option>';
  el.trackingExerciseSelector.disabled=true;
  el.trackingResults.innerHTML=isPublicTrackingView()
    ? '<div class="empty-state">Choose a muscle group and exercise to review James\'s progress.</div>'
    : '<div class="empty-state">Choose an exercise and time range to review its history.</div>';
  updateTrackingDashboard();
}

function setupWorkoutTracking(){
  TRACKING_MUSCLE_GROUPS.forEach(group=>{
    const option=document.createElement("option");
    option.value=group;
    option.textContent=group;
    el.trackingMuscleGroup.appendChild(option);
  });

  const now=new Date();
  el.trackingMonth.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  el.trackingRange.value="auto";
  el.trackingMonthWrap.hidden=true;

  el.trackingMuscleGroup.addEventListener("change",populateTrackingExercises);

  el.trackingRange.addEventListener("change",()=>{
    el.trackingMonthWrap.hidden=el.trackingRange.value!=="month";
    if(el.trackingExerciseSelector.value){
      renderProgressHistory();
    }
  });

  el.trackingMonth.addEventListener("change",()=>{
    if(el.trackingRange.value==="month" && el.trackingExerciseSelector.value){
      renderProgressHistory();
    }
  });

  el.showProgressButton.addEventListener("click",renderProgressHistory);
  el.viewJamesProgressButton?.addEventListener("click",toggleJamesProgressView);
}

function populateTrackingExercises(){
  const group=el.trackingMuscleGroup.value;
  el.trackingExerciseSelector.innerHTML="";

  const placeholder=document.createElement("option");
  placeholder.value="";

  if(!group){
    placeholder.textContent="Select a muscle group first…";
    el.trackingExerciseSelector.disabled=true;
    el.trackingExerciseSelector.appendChild(placeholder);
    return;
  }

  placeholder.textContent="Select an exercise…";
  el.trackingExerciseSelector.appendChild(placeholder);
  el.trackingExerciseSelector.disabled=false;

  getAllTrackableExercises()
    .filter(exercise=>exercise.muscleGroups.includes(group))
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(exercise=>{
      const option=document.createElement("option");
      option.value=exercise.id;
      option.textContent=exercise.name;
      el.trackingExerciseSelector.appendChild(option);
    });
}

function getAllTrackableExercises(){
  return getTrackingExerciseLibrary().map(exercise=>{
    const aliases=[exercise.id,...(CENTRAL_TRACKING_ALIASES[exercise.id]||[])];
    const prescription=findCentralExercisePrescription(exercise.id,aliases);

    return {
      id:exercise.id,
      name:exercise.name,
      prescription,
      noLoad:exercise.tracksWeight===false,
      side:Boolean(exercise.side || exercise.sideVariant),
      variants:Array.isArray(exercise.variants)?exercise.variants.slice():[],
      levels:exercise.id==="dragon-flag-progression" ? DRAGON_LEVELS : null,
      storageIds:[...new Set(aliases)],
      muscleGroups:getCentralTrackingMuscleGroups(exercise)
    };
  });
}

function getCentralTrackingMuscleGroups(exercise){
  // Workout Tracking now mirrors the Split Manager library exactly.
  // Each exercise appears only under its assigned library group.
  return exercise && exercise.group ? [exercise.group] : [];
}

function findCentralExercisePrescription(exerciseId,aliases){
  let found="";

  WORKOUT_SPLITS.some(split=>
    split.days.some(day=>
      day.exercises.some(ex=>{
        const ids=[
          ex.id,
          ex.trackingId,
          ...(ex.options||[]).flatMap(opt=>[opt.id,opt.trackingId])
        ].filter(Boolean);

        if(ids.some(id=>aliases.includes(id))){
          found=ex.prescription||"";
          return true;
        }
        return false;
      })
    )
  );

  return found;
}

function getTrackingExercise(exerciseId){
  return getAllTrackableExercises().find(item=>item.id===exerciseId) || null;
}

function getLogsForTrackingExercise(exercise){
  if(!exercise) return [];
  if(exercise.id==="cycling") return getTrackingCyclingLogs();
  // Logging and Tracking intentionally share this canonical implementation.
  return getWorkoutHistoryForTracking(exercise.id);
}

function inferMuscleGroups(exercise){
  const text=`${exercise.id||""} ${exercise.name||""}`.toLowerCase();
  const groups=new Set();
  const has=(...terms)=>terms.some(term=>text.includes(term));

  if(has("cycling","treadmill")) groups.add("Cardio");
  if(has("pull-up","pull up","pulldown","pull down","row","rear-delt","rear delt","reverse pec","shrug","hyperextension")) groups.add("Back");
  if(has("pull-up","pull up","pulldown","pull down","row","curl")) groups.add("Biceps");
  if(has("chest","bench","incline press","pec","fly","dip","flat press")) groups.add("Chest");
  if(has("shoulder","lateral","rear-delt","rear delt","reverse pec","press")) groups.add("Shoulders");
  if(has("triceps","tricep","pushdown","overhead cable","press","dip")) groups.add("Triceps");
  if(has("wrist","hammer")) groups.add("Forearms");
  if(has("squat","leg press","leg extension","bulgarian")) groups.add("Quadriceps");
  if(has("romanian","deadlift","hamstring","hyperextension","bulgarian")) groups.add("Hamstrings");
  if(has("squat","leg press","glute","hip abduction","romanian","deadlift","bulgarian","hyperextension")) groups.add("Glutes");
  if(has("adduction","copenhagen")) groups.add("Adductors");
  if(has("calf")) groups.add("Calves");
  if(has("crunch","dragon","ab wheel","woodchop","copenhagen","core")) groups.add("Core");

  return [...groups];
}

function renderSelectedWorkoutDay(){
  const split=getSelectedWorkoutSplit();
  const day=split ? split.days.find(item=>item.id===el.workoutDaySelector.value) : null;
  el.workoutLoggingMessage.hidden=true;

  if(!split){
    clearRenderedWorkout();
    return;
  }

  if(!day){
    clearRenderedWorkout();
    return;
  }

  el.selectedDayDescription.textContent=`${split.name} · ${day.label}`;
  el.selectedDayDescription.hidden=false;
  el.gymCompatibilityCard.hidden=false;
  refreshLoggingGymSelector();

  const hasCycling=day.exercises.some(isCyclingLoggingExercise);
  el.inlineCyclingContainer.hidden=!hasCycling;

  if(hasCycling){
    syncCommuteDateFromWorkoutDate();
    update();
  }

  renderWarmups(day);
  renderWorkingExercises(day);

  el.warmupContainer.hidden=!day.warmups.length;
  el.workingSetsContainer.hidden=!day.exercises.some(exercise=>!isCyclingLoggingExercise(exercise));
}

function renderWarmups(day){
  el.warmupList.innerHTML="";
  const dateValue=normalizeWorkoutDate(el.strengthWorkoutDate.value);
  const saved=getWarmupState(el.workoutSplitSelector.value,day.id,dateValue);

  day.warmups.forEach(([name,prescription],index)=>{
    const label=document.createElement("label");
    label.className="warmup-item";

    const checkbox=document.createElement("input");
    checkbox.type="checkbox";
    checkbox.checked=Boolean(saved[index]);
    label.classList.toggle("completed",checkbox.checked);

    const copy=document.createElement("span");
    copy.className="warmup-copy";

    const title=document.createElement("span");
    title.className="warmup-name";
    title.textContent=name;

    const detail=document.createElement("span");
    detail.className="warmup-prescription";
    detail.textContent=prescription;

    copy.append(title,detail);
    label.append(checkbox,copy);

    checkbox.addEventListener("change",()=>{
      label.classList.toggle("completed",checkbox.checked);
      saveWarmupState(el.workoutSplitSelector.value,day.id,index,checkbox.checked);
    });

    el.warmupList.appendChild(label);
  });
}

function renderWorkingExercises(day){
  el.workingExerciseList.innerHTML="";
  day.exercises
    .filter(exercise=>!isCyclingLoggingExercise(exercise))
    .forEach(exercise=>{
      el.workingExerciseList.appendChild(buildWorkingExerciseCard(exercise));
    });

  setupWorkoutAccordion(el.workingExerciseList);
}

function isCyclingLoggingExercise(exercise){
  if(!exercise) return false;
  return exercise.id==="cycling" ||
    exercise.trackingId==="cycling" ||
    String(exercise.name||"").trim().toLowerCase()==="cycling";
}

function syncCommuteDateFromWorkoutDate(){
  const normalized=normalizeWorkoutDate(el.strengthWorkoutDate.value);
  if(!normalized) return;

  const [month,day,year]=normalized.split("/");
  el.commuteDate.value=`${year}-${month}-${day}`;
}

function buildTreadmillExerciseCard(exercise){
  const card=document.createElement("article");
  card.className="logging-exercise-card";

  const head=document.createElement("div");
  head.className="logging-exercise-head";
  const title=document.createElement("h3");
  title.textContent=exercise.name||"Treadmill";
  const prescription=document.createElement("p");
  prescription.className="exercise-prescription";
  prescription.textContent="Duration · incline";
  head.append(title,prescription);
  card.appendChild(head);

  const body=document.createElement("div");
  body.className="exercise-logger-shell";

  const compare=document.createElement("div");
  compare.className="pr-compare-card";
  body.appendChild(compare);

  const form=document.createElement("div");
  form.className="treadmill-form";

  const minLabel=document.createElement("label");
  minLabel.innerHTML='<span class="unit">Minutes</span>';
  const minutes=document.createElement("input");
  minutes.type="number";minutes.inputMode="numeric";minutes.min="0";minutes.step="1";minutes.placeholder="20";
  minLabel.appendChild(minutes);

  const secLabel=document.createElement("label");
  secLabel.innerHTML='<span class="unit">Seconds</span>';
  const seconds=document.createElement("input");
  seconds.type="number";seconds.inputMode="numeric";seconds.min="0";seconds.max="59";seconds.step="1";seconds.placeholder="00";
  secLabel.appendChild(seconds);

  const inclineLabel=document.createElement("label");
  inclineLabel.innerHTML='<span class="unit">Incline (%)</span>';
  const incline=document.createElement("input");
  incline.type="number";incline.inputMode="decimal";incline.step="0.1";incline.placeholder="0.0";
  inclineLabel.appendChild(incline);

  const button=document.createElement("button");
  button.type="button";button.className="primary-button";button.textContent="Log Treadmill";

  form.append(minLabel,secLabel,inclineLabel,button);
  body.appendChild(form);

  const message=document.createElement("p");
  message.className="set-message";
  body.appendChild(message);

  const list=document.createElement("ul");
  list.className="set-log-list";
  body.appendChild(list);
  card.appendChild(body);

  const refresh=()=>{
    renderPRComparison("treadmill",exercise,compare);
    renderCurrentDateSetEntries("treadmill",list);
  };
  refresh();

  button.addEventListener("click",()=>{
    message.textContent="";
    const date=normalizeWorkoutDate(el.strengthWorkoutDate.value);
    if(!date){message.textContent="Enter a valid workout date first.";return}

    const mins=Number(minutes.value||0);
    const secs=Number(seconds.value||0);
    const inclineValue=Number(incline.value||0);

    if(!Number.isInteger(mins)||mins<0||!Number.isInteger(secs)||secs<0||secs>59){
      message.textContent="Enter a valid MM:SS duration.";
      return;
    }

    const total=Math.round(mins*60+secs);
    if(total<=0){message.textContent="Treadmill duration must be greater than zero.";return}
    if(!Number.isFinite(inclineValue)){message.textContent="Enter a valid incline.";return}

    const split=getSelectedWorkoutSplit();
    const logs=getSetLogs("treadmill");
    logs.push({
      id:makeLogId(),
      date,
      splitId:split?.id||null,
      splitName:split?.name||null,
      dayId:el.workoutDaySelector.value||null,
      performedExerciseId:"treadmill",
      performedExerciseName:"Treadmill",
      load:null,
      reps:total,
      durationSeconds:total,
      incline:inclineValue,
      timestamp:Date.now()
    });
    saveSetLogs("treadmill",logs);
    minutes.value="";seconds.value="";
    refresh();
    if(el.trackingExerciseSelector.value==="treadmill") renderProgressHistory();
  });

  return card;
}

function buildWorkingExerciseCard(exercise){
  if((exercise.trackingId||exercise.id)==="treadmill"){
    return buildTreadmillExerciseCard(exercise);
  }

  const card=document.createElement("article");
  card.className="logging-exercise-card";

  const head=document.createElement("div");
  head.className="logging-exercise-head";

  const title=document.createElement("h3");
  title.textContent=exercise.name;

  const prescription=document.createElement("p");
  prescription.className="exercise-prescription";
  prescription.textContent=exercise.prescription;

  head.append(title,prescription);

  if(exercise.note){
    const note=document.createElement("p");
    note.className="exercise-note";
    note.textContent=exercise.note;
    head.appendChild(note);
  }

  card.appendChild(head);

  const substitutePanel=document.createElement("div");
  substitutePanel.className="substitute-panel";

  const substituteToggleLabel=document.createElement("label");
  substituteToggleLabel.className="substitute-toggle";

  const substituteToggle=document.createElement("input");
  substituteToggle.type="checkbox";

  const substituteToggleText=document.createElement("span");
  substituteToggleText.textContent="Use substitute exercise";

  substituteToggleLabel.append(substituteToggle,substituteToggleText);

  const substitutePicker=document.createElement("div");
  substitutePicker.className="substitute-picker";
  substitutePicker.hidden=true;

  const substituteSelect=document.createElement("select");
  substituteSelect.innerHTML='<option value="">Select substitute exercise…</option>';
  populateSubstituteExerciseSelect(substituteSelect,exercise);

  const substituteNote=document.createElement("p");
  substituteNote.className="substitute-active-note";
  substituteNote.textContent="Sets will be stored under the exercise you actually perform, while keeping the planned exercise in the log metadata.";

  substitutePicker.append(substituteSelect,substituteNote);
  substitutePanel.append(substituteToggleLabel,substitutePicker);
  card.appendChild(substitutePanel);

  const loggerShell=document.createElement("div");
  loggerShell.className="exercise-logger-shell";
  card.appendChild(loggerShell);

  function activeExercise(){
    if(!substituteToggle.checked) return exercise;
    const selected=getManagerExerciseLibrary().find(item=>item.id===substituteSelect.value);
    return selected ? managerLibraryExerciseToLoggingExercise(selected) : exercise;
  }

  function rebuildLogger(){
    loggerShell.innerHTML="";
    const active=activeExercise();
    const substituted=substituteToggle.checked && substituteSelect.value;

    if(substituteToggle.checked && !substituteSelect.value){
      const prompt=document.createElement("p");
      prompt.className="set-message";
      prompt.textContent="Select the exercise you are performing instead.";
      loggerShell.appendChild(prompt);
      return;
    }

    loggerShell.appendChild(
      buildExerciseLogger(active,{
        plannedExercise:exercise,
        substituted:Boolean(substituted)
      })
    );
  }

  substituteToggle.addEventListener("change",()=>{
    substitutePicker.hidden=!substituteToggle.checked;
    rebuildLogger();
  });

  substituteSelect.addEventListener("change",rebuildLogger);

  rebuildLogger();

  if(exercise.subexercise){
    card.appendChild(buildSubexerciseBox(exercise.subexercise));
  }

  return card;
}

function populateSubstituteExerciseSelect(select,plannedExercise){
  const plannedId=plannedExercise.trackingId||plannedExercise.id||"";
  const library=getManagerExerciseLibrary()
    .filter(item=>item.id!=="cycling" && item.id!=="treadmill" && !item.noVolume);

  const grouped=new Map();

  library.forEach(item=>{
    if(item.id===plannedId) return;
    const group=item.group||"Other";
    if(!grouped.has(group)) grouped.set(group,[]);
    grouped.get(group).push(item);
  });

  [...grouped.keys()].sort().forEach(group=>{
    const optgroup=document.createElement("optgroup");
    optgroup.label=group;

    grouped.get(group)
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(item=>{
        const option=document.createElement("option");
        option.value=item.id;
        option.textContent=item.name;
        optgroup.appendChild(option);
      });

    select.appendChild(optgroup);
  });
}

function managerLibraryExerciseToLoggingExercise(item){
  const exercise={
    id:item.id,
    trackingId:item.id,
    name:item.name,
    prescription:"Substitute exercise",
    noLoad:item.tracksWeight===false,
    assistanceToggle:Boolean(item.assistanceToggle),
    side:Boolean(item.side),
    choiceLabel:item.choiceLabel||"Variation"
  };

  if(Array.isArray(item.variants)&&item.variants.length){
    exercise.options=item.variants.map(variant=>({
      id:item.id,
      trackingId:item.id,
      name:variant,
      variant,
      noLoad:item.tracksWeight===false,
      side:Boolean(item.side || (item.sideVariant && item.sideVariant===variant))
    }));
  }

  if(item.unit==="seconds"){
    exercise.repsLabel="Seconds";
  }

  return exercise;
}

function buildExerciseLogger(exercise,{plannedExercise,substituted}){
  const wrapper=document.createElement("div");

  const choices=document.createElement("div");
  choices.className="exercise-choice-grid";

  let exerciseSelect=null;
  let sideSelect=null;
  let levelSelect=null;

  if(exercise.options){
    const label=document.createElement("label");
    label.innerHTML=`<span class="unit">${escapeHtml(exercise.choiceLabel || "Exercise")}</span>`;
    exerciseSelect=document.createElement("select");

    exercise.options.forEach((opt,index)=>{
      const option=document.createElement("option");
      option.value=String(index);
      option.textContent=opt.name;
      exerciseSelect.appendChild(option);
    });

    label.appendChild(exerciseSelect);
    choices.appendChild(label);
  }

  if(exercise.levels){
    const label=document.createElement("label");
    label.innerHTML='<span class="unit">Dragon flag level</span>';
    levelSelect=document.createElement("select");

    exercise.levels.forEach((level,index)=>{
      const option=document.createElement("option");
      option.value=String(index);
      option.textContent=`${level.name} — ${level.prescription}`;
      levelSelect.appendChild(option);
    });

    label.appendChild(levelSelect);
    choices.appendChild(label);
  }

  if(exercise.side || (exercise.options && exercise.options.some(opt=>opt.side))){
    const label=document.createElement("label");
    label.innerHTML='<span class="unit">Select side</span>';
    sideSelect=document.createElement("select");
    sideSelect.innerHTML='<option value="">Select side…</option><option value="Left">Left</option><option value="Right">Right</option>';
    label.appendChild(sideSelect);
    choices.appendChild(label);
  }

  if(choices.children.length){
    if(choices.children.length===1) choices.classList.add("single");
    wrapper.appendChild(choices);
  }

  let assistedCheckbox=null;
  let assistanceWeight=null;
  let assistanceWeightWrap=null;

  if(exercise.assistanceToggle){
    const assistanceRow=document.createElement("div");
    assistanceRow.className="assistance-row";

    const checkLabel=document.createElement("label");
    checkLabel.className="assistance-check";

    assistedCheckbox=document.createElement("input");
    assistedCheckbox.type="checkbox";

    const checkText=document.createElement("span");
    checkText.textContent=`Assisted ${exercise.name}`;

    checkLabel.append(assistedCheckbox,checkText);

    assistanceWeightWrap=document.createElement("label");
    assistanceWeightWrap.className="assistance-weight";
    assistanceWeightWrap.hidden=true;
    assistanceWeightWrap.innerHTML='<span class="unit">Assistance (+) / added weight (−), lb</span>';

    assistanceWeight=document.createElement("input");
    assistanceWeight.type="number";
    assistanceWeight.step="0.5";
    assistanceWeight.placeholder="0 = none, negative = added weight";
    assistanceWeightWrap.appendChild(assistanceWeight);

    assistanceRow.append(checkLabel,assistanceWeightWrap);
    wrapper.appendChild(assistanceRow);

    const bodyWeightWrap=document.createElement("label");
    bodyWeightWrap.className="assistance-weight";
    bodyWeightWrap.innerHTML='<span class="unit">Body / total weight for PR (lb)</span>';
    const bodyWeightInput=document.createElement("input");
    bodyWeightInput.type="number";
    bodyWeightInput.min="1";
    bodyWeightInput.step="0.5";
    bodyWeightInput.placeholder="e.g. 180";
    if(el.weightPounds?.value) bodyWeightInput.value=el.weightPounds.value;
    bodyWeightWrap.appendChild(bodyWeightInput);
    wrapper.appendChild(bodyWeightWrap);
    exercise._bodyWeightInput=bodyWeightInput;

    assistedCheckbox.addEventListener("change",()=>{
      assistanceWeightWrap.hidden=!assistedCheckbox.checked;
      if(!assistedCheckbox.checked) assistanceWeight.value="";
    });
  }

  const compare=document.createElement("div");
  compare.className="pr-compare-card";
  wrapper.appendChild(compare);

  const form=document.createElement("div");
  form.className="set-entry-form";

  const loadLabel=document.createElement("label");
  loadLabel.innerHTML='<span class="unit">Loading (lb)</span>';

  const load=document.createElement("input");
  load.type="number";
  load.min="0";
  load.step="0.5";
  load.placeholder="0";
  loadLabel.appendChild(load);

  const repsLabel=document.createElement("label");
  const repsCaption=document.createElement("span");
  repsCaption.className="unit";
  repsCaption.textContent=exercise.repsLabel || "Reps";
  repsLabel.appendChild(repsCaption);

  const reps=document.createElement("input");
  reps.type="number";
  reps.min="1";
  reps.step="1";
  reps.placeholder="0";
  repsLabel.appendChild(reps);

  const button=document.createElement("button");
  button.type="button";
  button.className="primary-button";
  button.textContent=substituted ? "Log Substitute Set" : "Log Set";

  form.append(loadLabel,repsLabel,button);
  wrapper.appendChild(form);

  const message=document.createElement("p");
  message.className="set-message";
  wrapper.appendChild(message);

  const list=document.createElement("ul");
  list.className="set-log-list";
  wrapper.appendChild(list);

  function resolvedExercise(){
    if(exercise.options){
      return exercise.options[Number(exerciseSelect.value)||0];
    }
    if(exercise.levels){
      return exercise.levels[Number(levelSelect.value)||0];
    }
    return exercise;
  }

  function storageIdFor(resolved){
    return canonicalExerciseIdForStorageId(
      exercise.trackingId||resolved.trackingId||resolved.id||exercise.id
    );
  }

  function refreshResolvedUI(){
    const resolved=resolvedExercise();
    const storageId=storageIdFor(resolved);

    loadLabel.style.display=resolved.noLoad ? "none" : "";

    if(sideSelect){
      sideSelect.parentElement.style.display=resolved.side ? "" : "none";
      if(!resolved.side) sideSelect.value="";
    }

    repsCaption.textContent=
      resolved.repsLabel ||
      exercise.repsLabel ||
      (exercise.id==="copenhagen-plank" ? "Seconds" : "Reps");

    renderCurrentDateSetEntries(storageId,list);
    renderPRComparison(storageId,exercise,compare,{
      side:resolved.side&&sideSelect?sideSelect.value:null,
      variant:resolved.variant || (exercise.options ? resolved.name : null)
    });
  }

  if(exerciseSelect) exerciseSelect.addEventListener("change",refreshResolvedUI);
  if(levelSelect) levelSelect.addEventListener("change",refreshResolvedUI);
  if(sideSelect) sideSelect.addEventListener("change",refreshResolvedUI);

  refreshResolvedUI();

  button.addEventListener("click",()=>{
    message.textContent="";
    const date=normalizeWorkoutDate(el.strengthWorkoutDate.value);

    if(!date){
      showWorkoutError("Choose a valid workout date.");
      el.strengthWorkoutDate.focus();
      return;
    }

    const resolved=resolvedExercise();
    const storageId=storageIdFor(resolved);

    if(resolved.side && (!sideSelect||!sideSelect.value)){
      message.textContent="Select Left or Right before logging this set.";
      if(sideSelect) sideSelect.focus();
      return;
    }

    const loadValue=resolved.noLoad ? null : Number(load.value);
    const repsValue=Number(reps.value);

    if(!resolved.noLoad && (!Number.isFinite(loadValue)||loadValue<0)){
      message.textContent="Loading must be zero or greater.";
      load.focus();
      return;
    }

    let assistanceValue=null;
    if(exercise.assistanceToggle && assistedCheckbox && assistedCheckbox.checked){
      assistanceValue=Number(assistanceWeight.value);
      if(!Number.isFinite(assistanceValue)){
        message.textContent="Enter a valid assistance / added weight.";
        assistanceWeight.focus();
        return;
      }
    }

    if(!Number.isInteger(repsValue)||repsValue<1){
      message.textContent=`${resolved.repsLabel==="Seconds" ? "Seconds" : "Reps"} must be a whole number of at least 1.`;
      reps.focus();
      return;
    }

    let bodyWeightValue=null;
    if(exercise.assistanceToggle){
      bodyWeightValue=Number(exercise._bodyWeightInput?.value);
      if(!Number.isFinite(bodyWeightValue)||bodyWeightValue<=0){
        message.textContent="Enter your body / total weight so the PR can be calculated.";
        exercise._bodyWeightInput?.focus();
        return;
      }
    }

    const selectedSplit=getSelectedWorkoutSplit();

    workoutHistory.append(storageId,{
      id:makeLogId(),
      date,
      splitId:selectedSplit ? selectedSplit.id : null,
      splitName:selectedSplit ? selectedSplit.name : null,
      dayId:el.workoutDaySelector.value || null,

      plannedExerciseId:plannedExercise.trackingId||plannedExercise.id||null,
      plannedExerciseName:plannedExercise.name||null,
      performedExerciseId:storageId,
      performedExerciseName:exercise.name||null,
      substituted:Boolean(substituted),

      load:loadValue,
      reps:repsValue,
      side:resolved.side ? sideSelect.value : null,
      variant:resolved.variant || (exercise.options ? resolved.name : null),
      assisted:exercise.assistanceToggle && assistedCheckbox ? assistedCheckbox.checked : false,
      assistanceWeight:exercise.assistanceToggle && assistedCheckbox && assistedCheckbox.checked ? assistanceValue : 0,
      bodyWeight:bodyWeightValue,
      timestamp:Date.now()
    });

    reps.value="";
    renderCurrentDateSetEntries(storageId,list);
    renderPRComparison(storageId,exercise,compare,{
      side:resolved.side&&sideSelect?sideSelect.value:null,
      variant:resolved.variant || (exercise.options ? resolved.name : null)
    });

    if(el.trackingExerciseSelector.value===storageId){
      renderProgressHistory();
    }
  });

  return wrapper;
}

function getResolvedExercise(exercise,exerciseSelect,levelSelect){
  if(exercise.options){
    return exercise.options.find(opt=>opt.id===exerciseSelect.value) || exercise.options[0];
  }
  if(exercise.levels){
    return exercise.levels.find(level=>level.id===levelSelect.value) || exercise.levels[0];
  }
  return exercise;
}

function buildSubexerciseBox(subexercise){
  const box=document.createElement("div");
  box.className="subexercise-box";

  const title=document.createElement("h4");
  title.textContent=subexercise.name;

  const note=document.createElement("p");
  note.className="exercise-note";
  note.textContent=subexercise.prescription;

  const form=document.createElement("div");
  form.className="subexercise-form";

  const loadLabel=document.createElement("label");
  loadLabel.innerHTML='<span class="unit">Loading (lb)</span>';
  const load=document.createElement("input");
  load.type="number"; load.min="0"; load.step="0.5"; load.placeholder="0";
  loadLabel.appendChild(load);

  const repsLabel=document.createElement("label");
  repsLabel.innerHTML='<span class="unit">Reps</span>';
  const reps=document.createElement("input");
  reps.type="number"; reps.min="1"; reps.step="1"; reps.placeholder="0";
  repsLabel.appendChild(reps);

  const button=document.createElement("button");
  button.type="button";
  button.className="primary-button";
  button.textContent="Log Finisher";

  form.append(loadLabel,repsLabel,button);

  const message=document.createElement("p");
  message.className="set-message";
  message.style.margin="8px 0";

  const list=document.createElement("ul");
  list.className="subexercise-log-list";

  box.append(title,note,form,message,list);
  renderCurrentDateSetEntries(subexercise.id,list);

  button.addEventListener("click",()=>{
    message.textContent="";
    const date=normalizeWorkoutDate(el.strengthWorkoutDate.value);
    if(!date){
      showWorkoutError("Choose a valid workout date.");
      return;
    }

    const loadValue=Number(load.value);
    const repsValue=Number(reps.value);

    if(!Number.isFinite(loadValue)||loadValue<0){
      message.textContent="Loading must be zero or greater.";
      return;
    }
    if(!Number.isInteger(repsValue)||repsValue<1){
      message.textContent="Reps must be a whole number of at least 1.";
      return;
    }

    const selectedSplit=getSelectedWorkoutSplit();

    workoutHistory.append(subexercise.id,{
      id:makeLogId(),
      date,
      splitId:selectedSplit ? selectedSplit.id : null,
      splitName:selectedSplit ? selectedSplit.name : null,
      dayId:el.workoutDaySelector.value || null,
      load:loadValue,
      reps:repsValue,
      side:null,
      timestamp:Date.now()
    });

    // Keep the last finisher loading value for the next set; only clear reps.
    reps.value="";
    renderCurrentDateSetEntries(subexercise.id,list);

    if(el.trackingExerciseSelector.value===subexercise.id){
      renderProgressHistory();
    }
  });

  return box;
}

function exercisePRMetric(exercise,entry){
  if(!entry) return null;

  const id=exercise?.trackingId||exercise?.id||entry.performedExerciseId||"";
  const isTimed=exercise?.repsLabel==="Seconds" ||
    exercise?.unit==="seconds" ||
    id==="copenhagen-plank" ||
    id==="treadmill" ||
    Number.isFinite(Number(entry.durationSeconds));

  if(isTimed){
    const seconds=Number(entry.durationSeconds ?? entry.reps);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const reps=Number(entry.reps);
  if(!Number.isFinite(reps)) return null;

  if(exercise?.assistanceToggle || entry.bodyWeight!==null && entry.bodyWeight!==undefined){
    const body=Number(entry.bodyWeight);
    const assistance=Number(entry.assistanceWeight||0);
    if(!Number.isFinite(body)) return null;
    return (body-assistance)*reps;
  }

  const load=Number(entry.load);
  if(!Number.isFinite(load)) return null;
  return load*reps;
}

function getExercisePR(exerciseId,exercise,filters={}){
  const logs=workoutHistory.read(exerciseId).filter(entry=>logMatchesPRFilter(entry,filters));
  let best=null;
  let bestMetric=-Infinity;

  logs.forEach(entry=>{
    const metric=exercisePRMetric(exercise,entry);
    if(metric!==null && metric>bestMetric){
      bestMetric=metric;
      best=entry;
    }
  });

  return best ? {entry:best,metric:bestMetric} : null;
}

function logMatchesPRFilter(entry,filters){
  if(filters.side && entry.side && entry.side!==filters.side) return false;
  if(filters.variant && entry.variant && entry.variant!==filters.variant) return false;
  return true;
}

function getPreviousDateLatestSet(exerciseId,currentDate,filters={}){
  const current=dateSortValue(currentDate);
  const candidates=workoutHistory.read(exerciseId)
    .filter(entry=>{
      if(!logMatchesPRFilter(entry,filters)) return false;
      const date=dateSortValue(entry.date);
      return Number.isFinite(date) && (!Number.isFinite(current) || date<current);
    });

  if(!candidates.length) return null;

  const latestDate=Math.max(...candidates.map(entry=>dateSortValue(entry.date)));
  return candidates
    .filter(entry=>dateSortValue(entry.date)===latestDate)
    .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))[0] || null;
}

function formatPRSet(exercise,entry,includeScore=false){
  if(!entry) return "—";
  const id=exercise?.trackingId||exercise?.id||entry.performedExerciseId||"";

  if(id==="treadmill"){
    return `${duration(Number(entry.durationSeconds??entry.reps))} · ${fmt(Number(entry.incline||0),1)}% incline`;
  }

  if(exercise?.repsLabel==="Seconds" || exercise?.unit==="seconds" || id==="copenhagen-plank"){
    return `${duration(Number(entry.durationSeconds??entry.reps))}`;
  }

  const side=entry.side?`${entry.side} · `:"";
  const variant=entry.variant?`${entry.variant} · `:"";

  if(exercise?.assistanceToggle || entry.bodyWeight!==null && entry.bodyWeight!==undefined){
    const body=Number(entry.bodyWeight);
    const assistance=Number(entry.assistanceWeight||0);
    const effective=Number.isFinite(body)?body-assistance:null;
    return `${side}${variant}${effective!==null?`${formatLoad(effective)} effective lb × `:""}${entry.reps} reps`;
  }

  const load=entry.load===null||entry.load===undefined?"":`${formatLoad(entry.load)} lb × `;
  return `${side}${variant}${load}${entry.reps} reps`;
}

function renderPRComparison(exerciseId,exercise,container,filters={}){
  if(!container) return;
  const date=normalizeWorkoutDate(el.strengthWorkoutDate?.value);
  const pr=getExercisePR(exerciseId,exercise,filters);
  const previous=getPreviousDateLatestSet(exerciseId,date,filters);

  container.innerHTML="";

  const prBox=document.createElement("div");
  prBox.className="pr-compare-item";
  prBox.innerHTML=`<span>Personal record</span><strong>${escapeHtml(pr?formatPRSet(exercise,pr.entry,true):"No PR yet")}</strong>`;

  const previousBox=document.createElement("div");
  previousBox.className="pr-compare-item";
  previousBox.innerHTML=`<span>Previous workout${previous?.date?` · ${escapeHtml(previous.date)}`:""}</span><strong>${escapeHtml(previous?formatPRSet(exercise,previous):"No previous set")}</strong>`;

  container.append(prBox,previousBox);
}

function appendTrackingPR(exercise,logs){
  const allLogs=getLogsForTrackingExercise(exercise);
  let best=null,bestMetric=-Infinity;

  allLogs.forEach(entry=>{
    const metric=exercisePRMetric(exercise,entry);
    if(metric!==null&&metric>bestMetric){bestMetric=metric;best=entry}
  });

  const card=document.createElement("div");
  card.className="progress-pr-card";
  card.innerHTML=`<span>Personal record</span><strong>${escapeHtml(best?formatPRSet(exercise,best):"No PR yet")}</strong>`;
  el.trackingResults.appendChild(card);
}

function renderCurrentDateSetEntries(exerciseId,list){
  const date=normalizeWorkoutDate(el.strengthWorkoutDate.value);
  const logs=workoutHistory.read(exerciseId)
    .filter(entry=>entry.date===date)
    .sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));

  list.innerHTML="";

  if(!date){
    const empty=document.createElement("li");
    empty.className="log-empty";
    empty.textContent="Enter a valid workout date to view or log sets.";
    list.appendChild(empty);
    return;
  }

  if(logs.length===0){
    const empty=document.createElement("li");
    empty.className="log-empty";
    empty.textContent="No sets logged for this date.";
    list.appendChild(empty);
    return;
  }

  logs.forEach((entry,index)=>{
    const item=document.createElement("li");
    const text=document.createElement("span");
    text.textContent=formatSetEntry(entry,index);

    const remove=document.createElement("button");
    remove.type="button";
    remove.className="delete-log";
    remove.textContent="Delete";
    remove.addEventListener("click",()=>{
      workoutHistory.remove(exerciseId,entry);
      renderCurrentDateSetEntries(exerciseId,list);
      if(el.trackingExerciseSelector.value===exerciseId) renderProgressHistory();
    });

    item.append(text,remove);
    list.appendChild(item);
  });
}

function formatSetEntry(entry,index){
  if(entry.performedExerciseId==="treadmill" || Number.isFinite(Number(entry.durationSeconds))){
    return `Set ${index+1}: ${duration(Number(entry.durationSeconds??entry.reps))} · ${fmt(Number(entry.incline||0),1)}% incline`;
  }

  const substitute=entry.substituted && entry.plannedExerciseName
    ? `Substitute for ${entry.plannedExerciseName} · `
    : "";
  const variant=entry.variant ? `${entry.variant} · ` : "";
  const side=entry.side ? `${entry.side} · ` : "";
  const assistance=entry.assisted
    ? (Number(entry.assistanceWeight)<0
        ? `Added ${formatLoad(Math.abs(Number(entry.assistanceWeight)))} lb · `
        : `Assistance ${formatLoad(entry.assistanceWeight)} lb · `)
    : "";
  const load=entry.load===null || entry.load===undefined ? "" : `${formatLoad(entry.load)} lb x `;
  return `Set ${index+1}: ${substitute}${variant}${side}${assistance}${load}${entry.reps}`;
}

function getSetLogs(exerciseId){
  try{
    const data=JSON.parse(appStorage.getItem("workoutSetLogs:"+exerciseId)||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function saveSetLogs(exerciseId,logs){
  appStorage.setItem("workoutSetLogs:"+exerciseId,JSON.stringify(logs));
}




let editingLibraryExercise=null;

function setupExerciseLibrarySettings(){
  el.refreshExerciseLibraryButton?.addEventListener("click",renderExerciseLibrarySettings);
  el.exerciseLibrarySearch?.addEventListener("input",renderExerciseLibrarySettings);
  el.closeExerciseEditorButton?.addEventListener("click",closeExerciseLibraryEditor);
  el.saveExerciseEditorButton?.addEventListener("click",saveExerciseLibraryEdit);
  el.deleteCustomExerciseButton?.addEventListener("click",deleteEditedCustomExercise);
  el.resetBuiltInExerciseButton?.addEventListener("click",resetEditedBuiltInExercise);
  renderExerciseLibrarySettings();
}

function renderExerciseLibrarySettings(){
  if(!el.exerciseLibrarySettingsList) return;

  const term=String(el.exerciseLibrarySearch?.value||"").trim().toLowerCase();
  const custom=getCustomExerciseLibrary().map(item=>({...item,_kind:"custom"}));
  const builtIn=window.currentUserIsAdmin
    ? getManagerExerciseLibrary().filter(item=>!item.custom).map(item=>({...item,_kind:"builtIn"}))
    : [];

  const items=[...custom,...builtIn]
    .filter(item=>!term || `${item.name} ${item.group}`.toLowerCase().includes(term))
    .sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));

  el.exerciseLibrarySettingsList.innerHTML="";

  if(!items.length){
    const empty=document.createElement("div");
    empty.className="managed-empty";
    empty.textContent=window.currentUserIsAdmin
      ? "No matching exercises."
      : "No custom exercises yet.";
    el.exerciseLibrarySettingsList.appendChild(empty);
    return;
  }

  items.forEach(item=>{
    const row=document.createElement("div");
    row.className="exercise-library-row";

    const copy=document.createElement("div");
    const side=item.side?" · Left/Right":"";
    const assist=item.assistanceToggle?" · Assistance":"";
    copy.innerHTML=`<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.group)} · ${item._kind==="builtIn"?"Built-in":"Custom"}${side}${assist}</span>`;

    const actions=document.createElement("div");
    actions.className="exercise-library-row-actions";

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="secondary-button";
    edit.textContent="Edit";
    edit.addEventListener("click",()=>openExerciseLibraryEditor(item));
    actions.appendChild(edit);

    row.append(copy,actions);
    el.exerciseLibrarySettingsList.appendChild(row);
  });
}

function openExerciseLibraryEditor(item){
  editingLibraryExercise=deepClone(item);
  el.exerciseLibraryEditor.hidden=false;
  el.exerciseEditorType.textContent=item._kind==="builtIn"?"BUILT-IN EXERCISE":"CUSTOM EXERCISE";
  el.exerciseEditorHeading.textContent=`Edit ${item.name}`;
  el.exerciseEditorName.value=item.name||"";
  el.exerciseEditorGroup.value=item.group||"Compound";
  el.exerciseEditorTracksWeight.checked=Boolean(item.tracksWeight);
  el.exerciseEditorTimed.checked=item.unit==="seconds";
  el.exerciseEditorNoVolume.checked=Boolean(item.noVolume);
  el.exerciseEditorSide.checked=Boolean(item.side);
  el.exerciseEditorAssistance.checked=Boolean(item.assistanceToggle);
  el.exerciseEditorVariants.value=(item.variants||[]).join("\n");
  el.exerciseEditorChoiceLabel.value=item.choiceLabel||"";
  el.exerciseEditorSideVariant.value=item.sideVariant||"";
  el.exerciseEditorMessage.textContent="";
  el.deleteCustomExerciseButton.hidden=item._kind!=="custom";
  el.resetBuiltInExerciseButton.hidden=item._kind!=="builtIn" || !BUILT_IN_EXERCISE_OVERRIDES[item.id];
  el.exerciseLibraryEditor.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function closeExerciseLibraryEditor(){
  editingLibraryExercise=null;
  if(el.exerciseLibraryEditor) el.exerciseLibraryEditor.hidden=true;
}

async function saveExerciseLibraryEdit(){
  if(!editingLibraryExercise) return;

  const name=el.exerciseEditorName.value.trim();
  if(!name){
    el.exerciseEditorMessage.textContent="Exercise name is required.";
    return;
  }

  const previousSide=Boolean(editingLibraryExercise.side);
  const noVolume=el.exerciseEditorNoVolume.checked;
  const updated={
    ...editingLibraryExercise,
    name,
    group:el.exerciseEditorGroup.value,
    tracksWeight:noVolume?false:el.exerciseEditorTracksWeight.checked,
    unit:noVolume?"none":(el.exerciseEditorTimed.checked?"seconds":"reps"),
    noVolume,
    side:Boolean(el.exerciseEditorSide.checked),
    assistanceToggle:Boolean(el.exerciseEditorAssistance.checked),
    variants:el.exerciseEditorVariants.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),
    choiceLabel:el.exerciseEditorChoiceLabel.value.trim()||null,
    sideVariant:el.exerciseEditorSideVariant.value.trim()||null,
    updatedAt:Date.now()
  };

  delete updated._kind;

  try{
    if(editingLibraryExercise._kind==="custom"){
      const library=getCustomExerciseLibrary();
      const index=library.findIndex(item=>item.id===updated.id);
      if(index<0) throw new Error("Custom exercise could not be found.");
      library[index]=updated;
      saveCustomExerciseLibrary(library);
      propagateExerciseDefinitionToSplits(updated);
    }else{
      if(!window.currentUserIsAdmin) throw new Error("Administrator access is required.");
      if(typeof window.saveBuiltInExerciseOverride!=="function") throw new Error("Shared exercise service is unavailable.");
      await window.saveBuiltInExerciseOverride(updated.id,updated);
      BUILT_IN_EXERCISE_OVERRIDES[updated.id]=updated;
    }

    if(!previousSide && updated.side){
      migrateLegacySideLogsForExercise(updated.id);
    }

    el.exerciseEditorMessage.style.color="var(--success)";
    el.exerciseEditorMessage.textContent="Exercise saved.";
    editingLibraryExercise={...updated,_kind:editingLibraryExercise._kind};
    el.resetBuiltInExerciseButton.hidden=editingLibraryExercise._kind!=="builtIn";
    renderExerciseLibrarySettings();
    refreshWorkoutSplitSelector();
    populateTrackingExercises();
  }catch(error){
    console.error(error);
    el.exerciseEditorMessage.style.color="var(--danger)";
    el.exerciseEditorMessage.textContent=error.message||"Unable to save exercise.";
  }
}

function propagateExerciseDefinitionToSplits(definition){
  const splits=getCustomSplits();
  let changed=false;

  splits.forEach(split=>{
    (split.days||[]).forEach(day=>{
      (day.workouts||[]).forEach(workout=>{
        if(workout.exerciseId!==definition.id) return;
        workout.name=definition.name;
        workout.type=definition.group;
        workout.unit=definition.unit;
        workout.noVolume=Boolean(definition.noVolume);
        workout.tracksWeight=Boolean(definition.tracksWeight);
        workout.assistanceToggle=Boolean(definition.assistanceToggle);
        workout.variants=(definition.variants||[]).slice();
        workout.choiceLabel=definition.choiceLabel||null;
        workout.side=Boolean(definition.side);
        workout.sideVariant=definition.sideVariant||null;
        changed=true;
      });
    });
  });

  if(changed) saveCustomSplits(splits);
}

function deleteEditedCustomExercise(){
  if(!editingLibraryExercise || editingLibraryExercise._kind!=="custom") return;

  if(!window.confirm(
    `Delete "${editingLibraryExercise.name}" from your exercise library?\n\n`+
    "Historical logs will be preserved. Existing split entries are also preserved until you remove or replace them in Split Manager."
  )) return;

  saveCustomExerciseLibrary(
    getCustomExerciseLibrary().filter(item=>item.id!==editingLibraryExercise.id)
  );
  closeExerciseLibraryEditor();
  renderExerciseLibrarySettings();
}

async function resetEditedBuiltInExercise(){
  if(!editingLibraryExercise || editingLibraryExercise._kind!=="builtIn" || !window.currentUserIsAdmin) return;
  if(!window.confirm(`Reset "${editingLibraryExercise.name}" to the built-in app definition for every user?`)) return;

  try{
    await window.deleteBuiltInExerciseOverride?.(editingLibraryExercise.id);
    delete BUILT_IN_EXERCISE_OVERRIDES[editingLibraryExercise.id];
    closeExerciseLibraryEditor();
    renderExerciseLibrarySettings();
    refreshWorkoutSplitSelector();
  }catch(error){
    el.exerciseEditorMessage.textContent=error.message||"Unable to reset built-in exercise.";
  }
}

function migrateLegacySideLogsForExercise(exerciseId){
  const logs=getSetLogs(exerciseId);
  if(!logs.length) return;

  const byDate=new Map();
  logs.forEach(log=>{
    const date=log.date||"";
    if(!byDate.has(date)) byDate.set(date,[]);
    byDate.get(date).push(log);
  });

  let changed=false;

  byDate.forEach(dateLogs=>{
    dateLogs.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
    dateLogs.forEach((log,index)=>{
      if(!log.side){
        log.side=index%2===0?"Left":"Right";
        changed=true;
      }
    });
  });

  if(changed) saveSetLogs(exerciseId,logs);
}

function migrateKnownSideExerciseLogs(){
  getManagerExerciseLibrary()
    .filter(item=>item.side)
    .forEach(item=>migrateLegacySideLogsForExercise(item.id));
}

const BACKUP_SCHEMA_VERSION="26.7";
const PERSONAL_GYMS_STORAGE_KEY="fitnessTrackerGyms";
const CUSTOM_EQUIPMENT_STORAGE_KEY="fitnessTrackerCustomEquipment";

const DEFAULT_GYM_EQUIPMENT=[
  "squat rack","smith machine","barbell bench","assisted pull-up/dip machine","shoulder press",
  "chest press","pec deck","cable machine","dumbbell rack","preacher bench","cable lat pulldown",
  "standing calf raise","ab crunch machine","seated curl","leg extension","horizontal leg press",
  "glute drive","hip abduction/adduction","roman chair","hyperextension bench","back extension machine",
  "seated calf raise","chest-supported row","cable row","treadmill","deadlift platform",
  "preacher curl machine","hack squat","inclined leg press","lat pulldown machine"
];

let editingGym=null;

function setupDataBackups(){
  el.exportWorkoutBackupButton?.addEventListener("click",exportWorkoutBackup);
  el.importWorkoutBackupButton?.addEventListener("click",()=>el.importWorkoutBackupFile.click());
  el.importWorkoutBackupFile?.addEventListener("change",restoreWorkoutBackupFile);
}

function exportWorkoutBackup(){
  const storage=window.exportAppStorageEntries?.()||{};
  const payload={
    format:"jim-gym-backup",
    schemaVersion:BACKUP_SCHEMA_VERSION,
    exportedAt:new Date().toISOString(),
    guest:Boolean(window.isAppGuest?.()),
    storage
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`jim-gym-backup-${managerDateStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);

  el.backupStatus.textContent=`Backup exported with ${Object.keys(storage).length} stored data records.`;
}

async function restoreWorkoutBackupFile(){
  const file=el.importWorkoutBackupFile.files?.[0];
  el.importWorkoutBackupFile.value="";
  if(!file) return;

  try{
    const parsed=JSON.parse(await file.text());
    if(!parsed || parsed.format!=="jim-gym-backup" || !parsed.storage || typeof parsed.storage!=="object"){
      throw new Error("That file is not a Jim Gym backup.");
    }

    if(!window.confirm(
      `Restore this backup from ${parsed.exportedAt||"an unknown date"}?\\n\\n`+
      "The current account/session data will be replaced by the backup."
    )) return;

    el.backupStatus.textContent="Restoring backup…";

    if(typeof window.restoreCurrentUserBackup==="function"){
      await window.restoreCurrentUserBackup(parsed.storage);
    }else{
      window.replaceAppStorageEntriesLocal?.(parsed.storage);
    }

    el.backupStatus.textContent="Backup restored. Reloading…";
    setTimeout(()=>location.reload(),600);
  }catch(error){
    console.error(error);
    el.backupStatus.textContent=error.message||"Backup restore failed.";
  }
}

function getPersonalGyms(){
  try{
    const data=JSON.parse(appStorage.getItem(PERSONAL_GYMS_STORAGE_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function savePersonalGyms(gyms){
  appStorage.setItem(PERSONAL_GYMS_STORAGE_KEY,JSON.stringify(gyms));
}

function getCustomEquipment(){
  try{
    const data=JSON.parse(appStorage.getItem(CUSTOM_EQUIPMENT_STORAGE_KEY)||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function saveCustomEquipment(items){
  appStorage.setItem(CUSTOM_EQUIPMENT_STORAGE_KEY,JSON.stringify(Array.from(new Set(items))));
}

function getGlobalEquipmentList(){
  const remote=window.globalFitnessConfig?.equipment;
  return Array.isArray(remote)&&remote.length ? remote : DEFAULT_GYM_EQUIPMENT;
}

function getAllEquipmentOptions(){
  return Array.from(new Set([...getGlobalEquipmentList(),...getCustomEquipment()]))
    .filter(Boolean)
    .sort((a,b)=>a.localeCompare(b));
}

function getGlobalGyms(){
  return Array.isArray(window.globalFitnessConfig?.gyms) ? window.globalFitnessConfig.gyms : [];
}

function setupGymManager(){
  el.newGymButton?.addEventListener("click",()=>openGymEditor());
  el.closeGymEditorButton?.addEventListener("click",closeGymEditor);
  el.addCustomEquipmentButton?.addEventListener("click",addCustomEquipmentItem);
  el.saveGymButton?.addEventListener("click",saveGymFromEditor);
  el.saveGlobalEquipmentButton?.addEventListener("click",saveGlobalEquipmentFromEditor);
  el.loggingGymSelector?.addEventListener("change",renderLoggingGymEquipment);

  if(window.currentUserIsAdmin){
    el.globalEquipmentAdmin.hidden=false;
    el.saveAsGlobalGymWrap.hidden=false;
    el.globalEquipmentTextarea.value=getGlobalEquipmentList().join("\\n");
  }else{
    el.globalEquipmentAdmin.hidden=true;
    el.saveAsGlobalGymWrap.hidden=true;
  }

  renderSavedGyms();
  refreshLoggingGymSelector();
}

function renderSavedGyms(){
  if(!el.savedGymList) return;
  el.savedGymList.innerHTML="";

  const entries=[
    ...getPersonalGyms().map(gym=>({...gym,_kind:"personal"})),
    ...getGlobalGyms().map(gym=>({...gym,_kind:"global"}))
  ];

  if(!entries.length){
    el.savedGymList.innerHTML='<div class="managed-empty">No gyms saved yet.</div>';
    return;
  }

  entries.forEach(gym=>{
    const row=document.createElement("div");
    row.className="gym-list-row";

    const copy=document.createElement("div");
    copy.innerHTML=`<strong>${escapeHtml(gym.name||"Unnamed gym")}</strong><span>${gym._kind==="global"?"Global":"Personal"} · ${(gym.equipment||[]).length} equipment items</span>`;

    const actions=document.createElement("div");
    actions.className="gym-list-actions";

    if(gym._kind==="personal" || window.currentUserIsAdmin){
      const edit=document.createElement("button");
      edit.type="button";
      edit.className="secondary-button";
      edit.textContent="Edit";
      edit.addEventListener("click",()=>openGymEditor(gym));
      actions.appendChild(edit);

      const remove=document.createElement("button");
      remove.type="button";
      remove.className="builder-delete-button";
      remove.textContent="🗑";
      remove.addEventListener("click",()=>deleteGymEntry(gym));
      actions.appendChild(remove);
    }

    row.append(copy,actions);
    el.savedGymList.appendChild(row);
  });
}

function openGymEditor(gym=null){
  editingGym=gym?deepClone(gym):null;
  el.gymEditor.hidden=false;
  el.gymEditorTitle.textContent=gym?`Edit ${gym.name}`:"Add Gym";
  el.gymNameInput.value=gym?.name||"";
  el.saveAsGlobalGym.checked=gym?gym._kind==="global":false;
  renderGymEquipmentChecklist(new Set(gym?.equipment||[]));
  el.gymEditorMessage.textContent="";
  el.gymEditor.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function closeGymEditor(){
  editingGym=null;
  el.gymEditor.hidden=true;
}

function renderGymEquipmentChecklist(selected=new Set()){
  el.gymEquipmentChecklist.innerHTML="";
  getAllEquipmentOptions().forEach(item=>{
    const label=document.createElement("label");
    label.className="gym-equipment-check";

    const input=document.createElement("input");
    input.type="checkbox";
    input.value=item;
    input.checked=selected.has(item);

    const span=document.createElement("span");
    span.textContent=item;

    label.append(input,span);
    el.gymEquipmentChecklist.appendChild(label);
  });
}

function addCustomEquipmentItem(){
  const item=el.customEquipmentInput.value.trim();
  if(!item) return;

  const custom=getCustomEquipment();
  if(!custom.some(existing=>existing.toLowerCase()===item.toLowerCase())){
    custom.push(item);
    saveCustomEquipment(custom);
  }

  el.customEquipmentInput.value="";
  const selected=new Set(
    [...el.gymEquipmentChecklist.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value)
  );
  selected.add(item);
  renderGymEquipmentChecklist(selected);
}

async function saveGymFromEditor(){
  const name=el.gymNameInput.value.trim();
  if(!name){
    el.gymEditorMessage.textContent="Enter a gym name.";
    return;
  }

  const equipment=[...el.gymEquipmentChecklist.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input=>input.value);

  const wantsGlobal=window.currentUserIsAdmin &&
    (editingGym?._kind==="global" || el.saveAsGlobalGym.checked);

  try{
    if(wantsGlobal){
      if(typeof window.saveGlobalGym!=="function") throw new Error("Global gym service is unavailable.");
      const id=await window.saveGlobalGym({
        id:editingGym?._kind==="global"?editingGym.id:null,
        name,
        equipment
      });

      const gyms=getGlobalGyms().filter(gym=>gym.id!==id);
      gyms.push({id,name,equipment});
      window.globalFitnessConfig={...(window.globalFitnessConfig||{}),gyms};
    }else{
      const gyms=getPersonalGyms();
      const id=editingGym?._kind==="personal"&&editingGym.id
        ? editingGym.id
        : makeSplitManagerId();
      const next={id,name,equipment,updatedAt:Date.now()};
      const index=gyms.findIndex(gym=>gym.id===id);
      if(index>=0) gyms[index]=next;
      else gyms.push(next);
      savePersonalGyms(gyms);
    }

    closeGymEditor();
    renderSavedGyms();
    refreshLoggingGymSelector();
  }catch(error){
    console.error(error);
    el.gymEditorMessage.textContent=error.message||"Gym could not be saved.";
  }
}

async function deleteGymEntry(gym){
  if(!window.confirm(`Delete "${gym.name}"?`)) return;

  if(gym._kind==="global"){
    if(!window.currentUserIsAdmin || typeof window.deleteGlobalGym!=="function") return;
    await window.deleteGlobalGym(gym.id);
    window.globalFitnessConfig={
      ...(window.globalFitnessConfig||{}),
      gyms:getGlobalGyms().filter(item=>item.id!==gym.id)
    };
  }else{
    savePersonalGyms(getPersonalGyms().filter(item=>item.id!==gym.id));
  }

  renderSavedGyms();
  refreshLoggingGymSelector();
}

async function saveGlobalEquipmentFromEditor(){
  if(!window.currentUserIsAdmin) return;

  const items=el.globalEquipmentTextarea.value
    .split(/\\r?\\n/)
    .map(item=>item.trim())
    .filter(Boolean);

  if(!items.length){
    el.globalEquipmentMessage.textContent="Keep at least one equipment item.";
    return;
  }

  try{
    await window.saveGlobalEquipmentList?.(items);
    window.globalFitnessConfig={...(window.globalFitnessConfig||{}),equipment:items};
    el.globalEquipmentMessage.textContent="Global equipment list saved.";
    renderGymEquipmentChecklist(new Set());
  }catch(error){
    el.globalEquipmentMessage.textContent=error.message||"Global equipment list could not be saved.";
  }
}

function refreshLoggingGymSelector(){
  if(!el.loggingGymSelector) return;

  const previous=el.loggingGymSelector.value;
  el.loggingGymSelector.innerHTML='<option value="">Choose a gym…</option>';

  [
    ...getPersonalGyms().map(gym=>({...gym,_kind:"personal"})),
    ...getGlobalGyms().map(gym=>({...gym,_kind:"global"}))
  ].forEach(gym=>{
    const option=document.createElement("option");
    option.value=`${gym._kind}:${gym.id}`;
    option.textContent=`${gym.name}${gym._kind==="global"?" · Global":""}`;
    el.loggingGymSelector.appendChild(option);
  });

  if([...el.loggingGymSelector.options].some(option=>option.value===previous)){
    el.loggingGymSelector.value=previous;
  }

  renderLoggingGymEquipment();
}

function findGymBySelectorValue(value){
  const [kind,id]=String(value||"").split(":");
  if(kind==="personal") return getPersonalGyms().find(gym=>gym.id===id)||null;
  if(kind==="global") return getGlobalGyms().find(gym=>gym.id===id)||null;
  return null;
}

function renderLoggingGymEquipment(){
  const gym=findGymBySelectorValue(el.loggingGymSelector?.value);
  if(!gym){
    el.loggingGymEquipment.textContent="Select a gym to review its equipment before starting the workout.";
    return;
  }

  el.loggingGymEquipment.innerHTML="";
  (gym.equipment||[]).sort((a,b)=>a.localeCompare(b)).forEach(item=>{
    const chip=document.createElement("span");
    chip.className="gym-equipment-chip";
    chip.textContent=item;
    el.loggingGymEquipment.appendChild(chip);
  });

  if(!(gym.equipment||[]).length){
    el.loggingGymEquipment.textContent="No equipment has been listed for this gym.";
  }
}

function setupSettingsPersistence(){
  loadSavedSettings();

  el.saveSettingsButton.addEventListener("click",()=>{
    el.settingsSaveStatus.textContent="";
    el.settingsSaveStatus.classList.remove("error");

    try{
      const settings={
        distanceMiles:el.distanceMiles.value,
        elevationFeet:el.elevationFeet.value,
        wheelDiameterInches:el.wheelDiameterInches.value,
        tirePressurePsig:el.tirePressurePsig.value,
        deadTrafficSeconds:el.deadTrafficSeconds.value,
        showAdvancedResults:el.showAdvancedResults.checked
      };

      validateSettingsBeforeSave(settings);
      appStorage.setItem("fitnessTrackerSettings",JSON.stringify(settings));

      el.advancedResults.hidden=!el.showAdvancedResults.checked;
      el.settingsSaveStatus.textContent="Settings saved.";
      update();
    }catch(error){
      el.settingsSaveStatus.textContent=error.message || "Unable to save settings.";
      el.settingsSaveStatus.classList.add("error");
    }
  });
}

function loadSavedSettings(){
  let saved=null;

  try{
    saved=JSON.parse(appStorage.getItem("fitnessTrackerSettings")||"null");
  }catch{
    saved=null;
  }

  if(saved && typeof saved==="object"){
    if(saved.distanceMiles!==undefined) el.distanceMiles.value=saved.distanceMiles;
    if(saved.elevationFeet!==undefined) el.elevationFeet.value=saved.elevationFeet;
    if(saved.wheelDiameterInches!==undefined) el.wheelDiameterInches.value=saved.wheelDiameterInches;
    if(saved.tirePressurePsig!==undefined) el.tirePressurePsig.value=saved.tirePressurePsig;
    if(saved.deadTrafficSeconds!==undefined) el.deadTrafficSeconds.value=saved.deadTrafficSeconds;
    el.showAdvancedResults.checked=Boolean(saved.showAdvancedResults);
  }else{
    // Preserve compatibility with the older standalone advanced-results preference.
    el.showAdvancedResults.checked=appStorage.getItem("showAdvancedResults")==="true";
  }

  el.advancedResults.hidden=!el.showAdvancedResults.checked;
}

function validateSettingsBeforeSave(settings){
  const positiveFields=[
    [settings.distanceMiles,"Commute distance"],
    [settings.wheelDiameterInches,"Wheel diameter"],
    [settings.tirePressurePsig,"Tire pressure"]
  ];

  positiveFields.forEach(([value,label])=>{
    const number=Number(value);
    if(!Number.isFinite(number)||number<=0){
      throw new Error(`${label} must be greater than zero before saving.`);
    }
  });

  const elevation=Number(settings.elevationFeet);
  if(!Number.isFinite(elevation)||elevation<0){
    throw new Error("Total elevation gain cannot be negative.");
  }

  const deadTraffic=Number(settings.deadTrafficSeconds);
  if(!Number.isFinite(deadTraffic)||deadTraffic<0){
    throw new Error("Dead traffic time cannot be negative.");
  }
}

function setupCyclingLogging(){
  el.logCommuteButton.addEventListener("click",logCurrentCommute);
}

function logCurrentCommute(){
  el.cyclingLogMessage.textContent="";
  el.cyclingLogMessage.classList.remove("error");

  try{
    const result=calculate();
    const dateIso=el.commuteDate.value;

    if(!dateIso){
      throw new Error("Select a commute date before logging.");
    }

    const date=formatIsoDateForLog(dateIso);
    const logs=getCyclingLogs();

    const selectedSplit=getSelectedWorkoutSplit();

    logs.push({
      id:makeLogId(),
      date,
      splitId:selectedSplit ? selectedSplit.id : null,
      splitName:selectedSplit ? selectedSplit.name : null,
      dayId:el.workoutDaySelector.value || null,
      commuteTime:el.commuteTime.value.trim(),
      movingVelocity:result.movingVelocity,
      calories:result.calories,
      power:result.power,
      force:result.force,
      timestamp:Date.now()
    });

    saveCyclingLogs(logs);

    el.cyclingLogMessage.textContent=`Commute logged for ${date}.`;

    if(el.trackingExerciseSelector.value==="cycling"){
      renderProgressHistory();
    }
  }catch(error){
    el.cyclingLogMessage.textContent=error.message || "Unable to log this commute.";
    el.cyclingLogMessage.classList.add("error");
  }
}

function getCyclingLogs(){
  try{
    const data=JSON.parse(appStorage.getItem("cyclingActivityLogs")||"[]");
    return Array.isArray(data)?data:[];
  }catch{
    return [];
  }
}

function saveCyclingLogs(logs){
  appStorage.setItem("cyclingActivityLogs",JSON.stringify(logs));
}

function formatIsoDateForLog(value){
  const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) throw new Error("Select a valid commute date before logging.");
  return `${match[2]}/${match[3]}/${match[1]}`;
}


function getSelectedTrackingMonth(){
  return el.trackingMonth.value || "";
}

function parseLogDateValue(value){
  const match=String(value||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!match) return NaN;
  return new Date(Number(match[3]),Number(match[1])-1,Number(match[2])).getTime();
}

function getTrackingRangeMode(){
  return el.trackingRange ? el.trackingRange.value : "month";
}

function getTrackingRangeBounds(logs=[]){
  const mode=getTrackingRangeMode();
  const now=new Date();
  const endOfToday=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);

  if(mode==="month"){
    const month=getSelectedTrackingMonth();
    if(!month) return {min:null,max:null};
    const [year,m]=month.split("-").map(Number);
    return {
      min:new Date(year,m-1,1).getTime(),
      max:new Date(year,m,0,23,59,59,999).getTime()
    };
  }

  const relativeMonths={
    "3m":3,
    "6m":6,
    "1y":12,
    "2y":24
  };

  if(relativeMonths[mode]){
    const start=new Date(now.getFullYear(),now.getMonth()-relativeMonths[mode]+1,1);
    return {min:start.getTime(),max:endOfToday.getTime()};
  }

  if(mode==="all" || mode==="auto"){
    const valid=logs.map(entry=>parseLogDateValue(entry.date)).filter(Number.isFinite);
    if(!valid.length) return {min:null,max:null};
    return {min:Math.min(...valid),max:Math.max(...valid)};
  }

  return {min:null,max:null};
}

function filterLogsForTrackingMonth(logs){
  const bounds=getTrackingRangeBounds(logs);
  if(bounds.min===null || bounds.max===null) return logs.slice();

  return logs.filter(entry=>{
    const value=parseLogDateValue(entry.date);
    return Number.isFinite(value) && value>=bounds.min && value<=bounds.max;
  });
}

function trackingMonthLabel(logs=[]){
  const mode=getTrackingRangeMode();

  if(mode==="month"){
    const month=getSelectedTrackingMonth();
    if(!month) return "Selected month";
    const [year,m]=month.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(new Date(year,m-1,1));
  }

  if(mode==="3m") return "Last 3 months";
  if(mode==="6m") return "Last 6 months";
  if(mode==="1y") return "Last 1 year";
  if(mode==="2y") return "Last 2 years";
  if(mode==="all") return "All time";

  const bounds=getTrackingRangeBounds(logs);
  if(bounds.min===null || bounds.max===null) return "Full history";

  const spanDays=Math.max(1,(bounds.max-bounds.min)/86400000);
  const fmtStart=new Intl.DateTimeFormat(undefined,{
    month:spanDays>730?"short":"long",
    year:"numeric"
  }).format(new Date(bounds.min));
  const fmtEnd=new Intl.DateTimeFormat(undefined,{
    month:spanDays>730?"short":"long",
    year:"numeric"
  }).format(new Date(bounds.max));

  return fmtStart===fmtEnd ? fmtStart : `${fmtStart} – ${fmtEnd}`;
}

function getAdaptiveTimeScaleInfo(min,max){
  const spanDays=Math.max(1,(Number(max)-Number(min))/86400000);

  if(spanDays<=45){
    return {
      maxTicks:7,
      format:value=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(Number(value)))
    };
  }

  if(spanDays<=180){
    return {
      maxTicks:7,
      format:value=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(Number(value)))
    };
  }

  if(spanDays<=730){
    return {
      maxTicks:8,
      format:value=>new Intl.DateTimeFormat(undefined,{month:"short",year:"2-digit"}).format(new Date(Number(value)))
    };
  }

  if(spanDays<=1825){
    return {
      maxTicks:8,
      format:value=>new Intl.DateTimeFormat(undefined,{month:"short",year:"numeric"}).format(new Date(Number(value)))
    };
  }

  return {
    maxTicks:7,
    format:value=>new Intl.DateTimeFormat(undefined,{year:"numeric"}).format(new Date(Number(value)))
  };
}

const activeTrackingCharts=[];

function registerTrackingChart(chart){
  activeTrackingCharts.push(chart);
  return chart;
}

function destroyTrackingCharts(){
  while(activeTrackingCharts.length){
    const chart=activeTrackingCharts.pop();
    try{chart.destroy()}catch{}
  }
}

function chartThemeColors(){
  const styles=getComputedStyle(document.documentElement);
  return {
    text:styles.getPropertyValue("--text").trim() || "#1c1c1e",
    muted:styles.getPropertyValue("--muted").trim() || "#6e6e73",
    border:styles.getPropertyValue("--border").trim() || "rgba(60,60,67,.16)",
    card:styles.getPropertyValue("--card").trim() || "#fff",
    field:styles.getPropertyValue("--field-bg").trim() || "#f2f2f7",
    accent:styles.getPropertyValue("--accent").trim() || "#007aff"
  };
}

function refreshTrackingChartsForTheme(){
  if(!activeTrackingCharts.length) return;
  const theme=chartThemeColors();

  activeTrackingCharts.forEach(chart=>{
    chart.options.color=theme.text;

    if(chart.options.plugins?.legend?.labels){
      chart.options.plugins.legend.labels.color=theme.text;
    }
    if(chart.options.plugins?.tooltip){
      chart.options.plugins.tooltip.backgroundColor=theme.card;
      chart.options.plugins.tooltip.titleColor=theme.text;
      chart.options.plugins.tooltip.bodyColor=theme.text;
      chart.options.plugins.tooltip.borderColor=theme.border;
    }

    Object.values(chart.options.scales||{}).forEach(scale=>{
      if(scale.ticks) scale.ticks.color=theme.muted;
      if(scale.grid) scale.grid.color=theme.border;
      if(scale.title) scale.title.color=theme.muted;
      if(scale.border) scale.border.color=theme.border;
    });

    chart.update("none");
  });
}

function createChartCanvas(wrapper,ariaLabel){
  const canvasWrap=document.createElement("div");
  canvasWrap.className="chart-canvas-wrap";

  const canvas=document.createElement("canvas");
  canvas.setAttribute("role","img");
  canvas.setAttribute("aria-label",ariaLabel);

  canvasWrap.appendChild(canvas);
  wrapper.appendChild(canvasWrap);
  return canvas;
}

function chartDateLabel(value){
  const date=new Date(Number(value));
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(date);
}

function chartTooltipDate(value){
  const date=new Date(Number(value));
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(date);
}

function chartPointStyle(symbol){
  return {
    circle:"circle",
    square:"rect",
    triangle:"triangle",
    diamond:"rectRot",
    cross:"cross"
  }[symbol] || "circle";
}

function chartRepPointColor(exercise,entry){
  const range=repRangeForEntry(exercise,entry);
  if(range.min!==null && range.max!==null && Number(entry.reps)>range.max) return "#1565c0";
  if(range.min!==null && range.max!==null && Number(entry.reps)<range.min) return "#111111";
  return repGradientColor(Number(entry.reps),range.min,range.max);
}

function chartRepStatus(exercise,entry){
  const range=repRangeForEntry(exercise,entry);
  if(range.min!==null && range.max!==null && Number(entry.reps)>range.max) return "above";
  if(range.min!==null && range.max!==null && Number(entry.reps)<range.min) return "below";
  return "in";
}

function strengthSegmentGradient(ctx,exercise){
  const chart=ctx.chart;
  const area=chart.chartArea;
  if(!area || !ctx.p0 || !ctx.p1) return chartThemeColors().accent;

  const first=ctx.p0.raw?._entry;
  const second=ctx.p1.raw?._entry;
  if(!first || !second) return chartThemeColors().accent;

  const gradient=chart.ctx.createLinearGradient(ctx.p0.x,ctx.p0.y,ctx.p1.x,ctx.p1.y);
  gradient.addColorStop(0,chartRepPointColor(exercise,first));
  gradient.addColorStop(1,chartRepPointColor(exercise,second));
  return gradient;
}

const repRangeArrowPlugin={
  id:"fitnessRepRangeArrows",
  afterDatasetsDraw(chart){
    const ctx=chart.ctx;
    ctx.save();

    chart.data.datasets.forEach((dataset,datasetIndex)=>{
      const meta=chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((element,index)=>{
        const raw=dataset.data[index];
        if(!raw || !raw._repStatus || raw._repStatus==="in") return;

        const x=element.x;
        const y=element.y;
        const up=raw._repStatus==="above";
        const color=up ? "#1565c0" : "#111111";
        const size=8;

        ctx.fillStyle=color;
        ctx.strokeStyle=color;
        ctx.lineWidth=1.5;
        ctx.beginPath();

        if(up){
          ctx.moveTo(x,y-size-5);
          ctx.lineTo(x-size,y+1);
          ctx.lineTo(x-size*0.35,y+1);
          ctx.lineTo(x-size*0.35,y+size+4);
          ctx.lineTo(x+size*0.35,y+size+4);
          ctx.lineTo(x+size*0.35,y+1);
          ctx.lineTo(x+size,y+1);
        }else{
          ctx.moveTo(x,y+size+5);
          ctx.lineTo(x-size,y-1);
          ctx.lineTo(x-size*0.35,y-1);
          ctx.lineTo(x-size*0.35,y-size-4);
          ctx.lineTo(x+size*0.35,y-size-4);
          ctx.lineTo(x+size*0.35,y-1);
          ctx.lineTo(x+size,y-1);
        }

        ctx.closePath();
        ctx.fill();
      });
    });

    ctx.restore();
  }
};

if(window.Chart){
  Chart.register(repRangeArrowPlugin);
  if(window.ChartZoom){
    try{Chart.register(window.ChartZoom)}catch{}
  }
}


function ensureChartJsAvailable(wrapper){
  if(window.Chart) return true;

  const warning=document.createElement("div");
  warning.className="empty-state";
  warning.textContent="Charts could not load. Check your internet connection and reload the app.";
  wrapper.appendChild(warning);
  return false;
}


let activeLogDetail=null;

function setupLogDetailSheet(){
  const close=closeLogDetailSheet;
  el.closeLogDetailButton?.addEventListener("click",close);
  el.doneLogDetailButton?.addEventListener("click",close);
  el.editLogDetailButton?.addEventListener("click",editActiveWorkoutLog);
  el.logDetailBackdrop?.addEventListener("click",close);

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && el.logDetailSheet && !el.logDetailSheet.hidden){
      close();
    }
  });

  el.deleteLogDetailButton?.addEventListener("click",()=>{
    if(!activeLogDetail || isPublicTrackingView()) return;

    const entry=activeLogDetail.entry;
    const label=activeLogDetail.kind==="cycling"
      ? `cycling log from ${entry.date}`
      : `${entry.performedExerciseName || activeLogDetail.exercise?.name || "workout"} set from ${entry.date}`;

    if(!window.confirm(`Delete this ${label}?\\n\\nThis action cannot be undone.`)) return;

    if(activeLogDetail.kind==="cycling"){
      saveCyclingLogs(getCyclingLogs().filter(log=>log.id!==entry.id));
      closeLogDetailSheet();
      renderCyclingProgress();
      updateTrackingDashboard();
      return;
    }

    const storageId=entry._storageId || entry.performedExerciseId || activeLogDetail.exercise?.id;
    if(storageId){
      workoutHistory.remove(storageId,entry);
    }

    closeLogDetailSheet();
    renderProgressHistory();
    updateTrackingDashboard();
  });
}

function editActiveWorkoutLog(){
  if(!activeLogDetail || activeLogDetail.kind==="cycling" || isPublicTrackingView()) return;

  const entry=activeLogDetail.entry;
  const storageId=entry._storageId || entry.performedExerciseId || activeLogDetail.exercise?.id;
  if(!storageId) return;

  const date=window.prompt("Workout date (MM/DD/YYYY)",entry.date||"");
  if(date===null) return;
  const normalizedDate=normalizeWorkoutDate(date);
  if(!normalizedDate){
    window.alert("Enter the date as MM/DD/YYYY.");
    return;
  }

  const timed=activeLogDetail.exercise?.id==="treadmill" ||
    activeLogDetail.exercise?.unit==="seconds" ||
    Number.isFinite(Number(entry.durationSeconds));
  const reps=window.prompt(timed ? "Duration in seconds" : "Reps",String(entry.durationSeconds??entry.reps??""));
  if(reps===null) return;
  const repsNumber=Number(reps);
  if(!Number.isInteger(repsNumber) || repsNumber<1){
    window.alert(timed ? "Duration must be a whole number of seconds." : "Reps must be a whole number of at least 1.");
    return;
  }

  const changes={date:normalizedDate,reps:repsNumber};
  if(timed && entry.durationSeconds!==undefined) changes.durationSeconds=repsNumber;

  if(entry.load!==null && entry.load!==undefined){
    const load=window.prompt("Loading (lb)",String(entry.load));
    if(load===null) return;
    const loadNumber=Number(load);
    if(!Number.isFinite(loadNumber) || loadNumber<0){
      window.alert("Loading must be zero or greater.");
      return;
    }
    changes.load=loadNumber;
  }

  if(entry.side){
    const side=window.prompt("Side (Left or Right)",entry.side);
    if(side===null) return;
    if(!["left","right"].includes(side.trim().toLowerCase())){
      window.alert("Side must be Left or Right.");
      return;
    }
    changes.side=side.trim().toLowerCase()==="left" ? "Left" : "Right";
  }

  if(entry.variant){
    const variant=window.prompt("Variation",entry.variant);
    if(variant===null) return;
    changes.variant=variant.trim()||null;
  }

  workoutHistory.update(storageId,entry,changes);
  closeLogDetailSheet();
  renderProgressHistory();
  updateTrackingDashboard();
}

function closeLogDetailSheet(){
  activeLogDetail=null;
  if(el.logDetailSheet) el.logDetailSheet.hidden=true;
  if(el.logDetailBackdrop) el.logDetailBackdrop.hidden=true;
  document.body.classList.remove("sheet-open");
}

function openLogDetailSheet(entry,context={}){
  if(!entry || !el.logDetailSheet) return;

  activeLogDetail={entry,...context};
  el.logDetailTitle.textContent=context.kind==="cycling"
    ? "Cycling Commute"
    : (entry.performedExerciseName || context.exercise?.name || "Workout Set");

  const rows=[];

  rows.push(["Date",entry.date || "—"]);

  if(entry.splitName) rows.push(["Split",entry.splitName]);
  if(entry.dayId) rows.push(["Workout day",formatWorkoutDayForDetail(entry)]);

  if(context.kind==="cycling"){
    rows.push(["Commute time",entry.commuteTime || "—"]);
    rows.push(["Average velocity",`${fmt(entry.movingVelocity,2)} mph`]);
    rows.push(["Calories",`${fmt(entry.calories,1)} kcal`]);
    rows.push(["Mechanical power",`${fmt(entry.power,1)} W`]);
    rows.push(["Force per leg",`${fmt(entry.force,1)} lbf`]);
  }else{
    if(entry.substituted && entry.plannedExerciseName){
      rows.push(["Planned",entry.plannedExerciseName]);
      rows.push(["Performed",entry.performedExerciseName || context.exercise?.name || "—"]);
    }else if(entry.performedExerciseName){
      rows.push(["Exercise",entry.performedExerciseName]);
    }

    if(entry.variant) rows.push(["Variation",entry.variant]);
    if(entry.side) rows.push(["Side",entry.side]);

    if(entry.assisted){
      rows.push(["Assistance",`${formatLoad(entry.assistanceWeight)} lb`]);
    }

    if(entry.load!==null && entry.load!==undefined){
      rows.push(["Loading",`${formatLoad(entry.load)} lb`]);
    }

    if(context.exercise?.id==="treadmill" || Number.isFinite(Number(entry.durationSeconds))){
      rows.push(["Duration",duration(Number(entry.durationSeconds??entry.reps))]);
      rows.push(["Incline",`${fmt(Number(entry.incline||0),1)}%`]);
    }else{
      rows.push([context.exercise?.id==="copenhagen-plank" ? "Seconds" : "Reps",String(entry.reps ?? "—")]);
    }
  }

  el.logDetailContent.innerHTML="";
  rows.forEach(([label,value])=>{
    const row=document.createElement("div");
    row.className="log-detail-row";

    const key=document.createElement("span");
    key.textContent=label;

    const val=document.createElement("strong");
    val.textContent=value;

    row.append(key,val);
    el.logDetailContent.appendChild(row);
  });

  if(el.deleteLogDetailButton){
    el.deleteLogDetailButton.hidden=isPublicTrackingView();
  }
  if(el.editLogDetailButton){
    el.editLogDetailButton.hidden=isPublicTrackingView() || context.kind==="cycling";
  }

  el.logDetailBackdrop.hidden=false;
  el.logDetailSheet.hidden=false;
  document.body.classList.add("sheet-open");
}

function formatWorkoutDayForDetail(entry){
  const split=entry.splitId ? getWorkoutSplit(entry.splitId) : null;
  const day=split?.days?.find(item=>item.id===entry.dayId);
  return day ? day.label : entry.dayId;
}

function attachChartInteraction(chart,context={}){
  if(!chart?.canvas) return chart;

  chart.$trackingKind=context.kind || "strength";
  chart.$trackingExercise=context.exercise || null;

  const resetButton=context.resetButton;
  if(resetButton){
    resetButton.addEventListener("click",()=>chart.resetZoom?.());
  }

  let lastTap=0;

  chart.canvas.addEventListener("click",event=>{
    const now=Date.now();

    if(now-lastTap<330){
      lastTap=0;
      chart.resetZoom?.();
      return;
    }
    lastTap=now;

    const hit=chart.getElementsAtEventForMode(
      event,
      "nearest",
      {intersect:true},
      true
    );

    if(!hit.length) return;

    const point=hit[0];
    const raw=chart.data.datasets[point.datasetIndex]?.data?.[point.index];
    const entry=raw?._entry;
    if(!entry) return;

    openLogDetailSheet(entry,{
      kind:context.kind || "strength",
      exercise:context.exercise || null
    });
  });

  return chart;
}

function addChartToolbar(wrapper,chart){
  const toolbar=document.createElement("div");
  toolbar.className="chart-toolbar";

  const hint=document.createElement("span");
  hint.className="chart-touch-hint";
  hint.textContent="Pinch to zoom · drag horizontally to pan · double-tap to reset · tap a point for details";

  const reset=document.createElement("button");
  reset.type="button";
  reset.className="chart-reset-button";
  reset.textContent="Reset view";
  reset.addEventListener("click",()=>chart.resetZoom?.());

  toolbar.append(hint,reset);
  wrapper.appendChild(toolbar);

  return reset;
}

function syncCyclingChartX(sourceChart){
  if(!sourceChart?.scales?.x) return;
  const min=sourceChart.scales.x.min;
  const max=sourceChart.scales.x.max;

  activeTrackingCharts.forEach(chart=>{
    if(chart===sourceChart || chart.$trackingKind!=="cycling") return;
    if(!chart.options?.scales?.x) return;

    chart.options.scales.x.min=min;
    chart.options.scales.x.max=max;
    chart.update("none");
  });
}

function enableChartZoom(options,kind){
  if(!options.plugins) options.plugins={};

  options.plugins.zoom={
    limits:{x:{minRange:1000*60*60*24}},
    pan:{
      enabled:true,
      mode:"x",
      threshold:4,
      onPanComplete:({chart})=>{
        if(kind==="cycling") syncCyclingChartX(chart);
      }
    },
    zoom:{
      mode:"x",
      wheel:{enabled:false},
      pinch:{enabled:true},
      drag:{enabled:false},
      onZoomComplete:({chart})=>{
        if(kind==="cycling") syncCyclingChartX(chart);
      }
    }
  };
}

function commonChartOptions(){
  const theme=chartThemeColors();

  return {
    responsive:true,
    maintainAspectRatio:false,
    animation:{duration:240,easing:"easeOutQuart"},
    interaction:{mode:"nearest",intersect:false},
    normalized:true,
    color:theme.text,
    layout:{padding:{top:8,right:2,bottom:0,left:0}},
    plugins:{
      legend:{
        display:true,
        position:"bottom",
        labels:{
          color:theme.text,
          usePointStyle:true,
          boxWidth:8,
          boxHeight:8,
          padding:16,
          font:{size:10.5,weight:"500"}
        }
      },
      tooltip:{
        enabled:true,
        backgroundColor:theme.card,
        titleColor:theme.text,
        bodyColor:theme.text,
        borderColor:theme.border,
        borderWidth:1,
        displayColors:true,
        padding:11,
        cornerRadius:12,
        titleFont:{size:12,weight:"700"},
        bodyFont:{size:11.5,weight:"500"}
      }
    }
  };
}

function dateLinearScaleOptions(){
  const theme=chartThemeColors();

  return {
    type:"linear",
    ticks:{
      color:theme.muted,
      autoSkip:true,
      font:{size:10},
      callback(value){
        const scale=this;
        const info=getAdaptiveTimeScaleInfo(scale.min,scale.max);
        scale.options.ticks.maxTicksLimit=info.maxTicks;
        return info.format(value);
      }
    },
    afterDataLimits(scale){
      const info=getAdaptiveTimeScaleInfo(scale.min,scale.max);
      scale.options.ticks.maxTicksLimit=info.maxTicks;
    },
    grid:{color:theme.border,drawTicks:false,lineWidth:.7},
    border:{display:false},
    title:{display:false}
  };
}

function renderCyclingProgress(){
  destroyTrackingCharts();
  const allLogs=getTrackingCyclingLogs().slice().sort((a,b)=>{
    const dateDifference=dateSortValue(a.date)-dateSortValue(b.date);
    return dateDifference!==0 ? dateDifference : (a.timestamp||0)-(b.timestamp||0);
  });
  const logs=filterLogsForTrackingMonth(allLogs);

  el.trackingResults.innerHTML="";

  const summary=document.createElement("div");
  summary.className="progress-summary";
  summary.innerHTML=
    `<h3>Cycling</h3>`+
    `<div class="tracking-meta">${logs.length} commute${logs.length===1?"":"s"} in ${escapeHtml(trackingMonthLabel(logs))}</div>`;
  el.trackingResults.appendChild(summary);

  if(!logs.length){
    const empty=document.createElement("div");
    empty.className="empty-state";
    empty.textContent=`No cycling commutes were logged in ${trackingMonthLabel(logs)}.`;
    el.trackingResults.appendChild(empty);
    return;
  }

  el.trackingResults.appendChild(
    buildDualAxisChart({
      title:"Calories & Average Force",
      subtitle:trackingMonthLabel(logs),
      logs,
      leftLabel:"Calories (kcal)",
      rightLabel:"Force per leg (lbf)",
      leftValue:entry=>entry.calories,
      rightValue:entry=>entry.force,
      leftFormat:value=>`${fmt(value,1)} kcal`,
      rightFormat:value=>`${fmt(value,1)} lbf`,
      leftColor:"#d97706",
      rightColor:"#2563eb"
    })
  );

  el.trackingResults.appendChild(
    buildDualAxisChart({
      title:"Commute Time & Average Velocity",
      subtitle:trackingMonthLabel(logs),
      logs,
      leftLabel:"Commute time (min)",
      rightLabel:"Average velocity (mph)",
      leftValue:entry=>commuteTimeToMinutes(entry.commuteTime),
      rightValue:entry=>entry.movingVelocity,
      leftFormat:value=>minutesToDuration(value),
      rightFormat:value=>`${fmt(value,2)} mph`,
      leftColor:"#7c3aed",
      rightColor:"#059669"
    })
  );

  renderCyclingLogList(logs);
}

function renderCyclingLogList(logs){
  const section=document.createElement("section");
  section.className="progress-log-section";

  const heading=document.createElement("h3");
  heading.textContent="Logged commutes";
  section.appendChild(heading);

  const list=document.createElement("ul");
  list.className="progress-list";

  logs.forEach(entry=>{
    const item=document.createElement("li");
    item.className="tracking-log-row";

    const datePart=document.createElement("span");
    datePart.className="progress-date";
    datePart.textContent=entry.date;

    const details=document.createElement("span");
    details.className="cycling-progress-entry";

    const time=document.createElement("strong");
    time.textContent=`Commute time: ${entry.commuteTime}`;

    const metrics=document.createElement("span");
    metrics.className="cycling-progress-detail";
    metrics.textContent=
      `${fmt(entry.movingVelocity,2)} mph · `+
      `${fmt(entry.calories,1)} kcal · `+
      `${fmt(entry.power,1)} W · `+
      `${fmt(entry.force,1)} lbf/leg`;

    details.append(time,metrics);

    const remove=createTrackingDeleteButton(
      `Delete cycling log from ${entry.date}`,
      ()=>{
        const confirmed=window.confirm(
          `Delete this cycling log from ${entry.date}?\n\n`+
          `Commute time: ${entry.commuteTime}\n`+
          `${fmt(entry.movingVelocity,2)} mph · ${fmt(entry.calories,1)} kcal · `+
          `${fmt(entry.power,1)} W · ${fmt(entry.force,1)} lbf/leg\n\n`+
          `This action cannot be undone.`
        );
        if(!confirmed) return;
        saveCyclingLogs(getCyclingLogs().filter(log=>log.id!==entry.id));
        renderCyclingProgress();
      }
    );

    item.append(datePart,details);
    if(!isPublicTrackingView()) item.appendChild(remove);
    list.appendChild(item);
  });

  section.appendChild(list);
  el.trackingResults.appendChild(section);
}

function renderProgressHistory(){
  destroyTrackingCharts();
  const exerciseId=el.trackingExerciseSelector.value;

  if(!exerciseId){
    el.trackingResults.innerHTML='<div class="empty-state">Select an exercise first.</div>';
    return;
  }

  if(exerciseId==="cycling"){
    renderCyclingProgress();
    return;
  }

  const exercise=getTrackingExercise(exerciseId);

  if(!exercise){
    el.trackingResults.innerHTML='<div class="empty-state">Exercise data could not be found.</div>';
    return;
  }

  let logs=getLogsForTrackingExercise(exercise).slice();

  if(exercise.levels){
    // Dragon Flag levels historically use their level IDs as storage keys.
    logs=[];
    exercise.levels.forEach(level=>{
      getWorkoutHistoryForTracking(level.id).forEach(log=>{
        logs.push({
          ...log,
          _storageId:level.id,
          levelId:level.id,
          levelName:level.name,
          levelPrescription:level.prescription,
          variant:level.name
        });
      });
    });
  }

  logs.sort((a,b)=>{
    const dateDiff=dateSortValue(a.date)-dateSortValue(b.date);
    return dateDiff!==0 ? dateDiff : (a.timestamp||0)-(b.timestamp||0);
  });

  logs=filterLogsForTrackingMonth(logs);

  el.trackingResults.innerHTML="";

  const summary=document.createElement("div");
  summary.className="progress-summary";
  summary.innerHTML=
    `<h3>${escapeHtml(exercise.name)}</h3>`+
    `<div class="tracking-meta">${logs.length} logged set${logs.length===1?"":"s"} in ${escapeHtml(trackingMonthLabel(logs))}${exercise.prescription ? " · "+escapeHtml(exercise.prescription) : ""}</div>`;
  el.trackingResults.appendChild(summary);
  appendTrackingPR(exercise,logs);

  if(!logs.length){
    const empty=document.createElement("div");
    empty.className="empty-state";
    empty.textContent=`No sets were logged for ${exercise.name} in ${trackingMonthLabel(logs)}.`;
    el.trackingResults.appendChild(empty);
    return;
  }

  el.trackingResults.appendChild(
    buildStrengthProgressChart(exercise,logs,exercise.levels || null)
  );

  renderStrengthLogList(exercise,logs);
}

function buildStrengthProgressChart(exercise,logs,dragonLevels){
  const isPullUp=exercise.id==="pull-up" || exercise.id==="pull-ups";
  const hasNormalLoad=logs.some(entry=>entry.load!==null && entry.load!==undefined);
  const usesAssistance=isPullUp && logs.some(entry=>entry.assisted || Number.isFinite(Number(entry.assistanceWeight)));

  let yLabel;
  let yValue;

  if(usesAssistance){
    yLabel="Assistance (lb)";
    yValue=entry=>entry.assisted ? Number(entry.assistanceWeight||0) : 0;
  }else if(hasNormalLoad){
    yLabel="Loading (lb)";
    yValue=entry=>Number(entry.load);
  }else{
    const timed=exercise.id==="copenhagen-plank" || exercise.id==="treadmill" || exercise.unit==="seconds";
    yLabel=timed ? "Duration (sec)" : "Reps";
    yValue=entry=>timed ? Number(entry.durationSeconds??entry.reps) : Number(entry.reps);
  }

  const wrapper=document.createElement("div");
  wrapper.className="chart-card";

  const heading=document.createElement("div");
  heading.className="chart-title";
  heading.innerHTML=`<h3>${escapeHtml(exercise.name)} Progress</h3><span class="chart-subtitle">${escapeHtml(trackingMonthLabel(logs))}</span>`;
  wrapper.appendChild(heading);

  const plotted=logs.map((entry,index)=>({
    ...entry,
    xTime:dateSortValue(entry.date)+(index*60000),
    yValue:yValue(entry)
  })).filter(entry=>Number.isFinite(entry.yValue));

  const seriesMap=buildTrackingSeries(exercise,plotted,dragonLevels);
  const datasets=[];

  seriesMap.forEach(series=>{
    datasets.push({
      label:series.label,
      data:series.points.map(point=>({
        x:point.xTime,
        y:point.yValue,
        _entry:point,
        _repStatus:chartRepStatus(exercise,point)
      })),
      parsing:false,
      borderWidth:2.4,
      tension:0,
      fill:false,
      pointStyle:chartPointStyle(series.symbol),
      pointRadius:ctx=>ctx.raw?._repStatus==="in" ? 5.5 : 0,
      pointHoverRadius:ctx=>ctx.raw?._repStatus==="in" ? 8 : 0,
      pointBackgroundColor:ctx=>ctx.raw?chartRepPointColor(exercise,ctx.raw._entry):chartThemeColors().accent,
      pointBorderColor:chartThemeColors().card,
      pointBorderWidth:1.5,
      segment:{
        borderColor:ctx=>strengthSegmentGradient(ctx,exercise)
      }
    });
  });

  if(!ensureChartJsAvailable(wrapper)){
    appendRepRangeLegend(wrapper,exercise,logs);
    return wrapper;
  }

  const canvas=createChartCanvas(wrapper,`${exercise.name} progress chart`);
  const theme=chartThemeColors();
  const options=commonChartOptions();

  options.scales={
    x:dateLinearScaleOptions(),
    y:{
      beginAtZero:false,
      grace:"12%",
      ticks:{color:theme.muted,maxTicksLimit:6},
      grid:{color:theme.border,drawTicks:false},
      border:{display:false},
      title:{display:true,text:yLabel,color:theme.muted,font:{size:11,weight:"600"}}
    }
  };

  enableChartZoom(options,"strength");

  options.plugins.tooltip.callbacks={
    title:items=>items.length ? chartTooltipDate(items[0].raw.x) : "",
    label:item=>{
      const entry=item.raw._entry;
      const variant=entry.variant?` · ${entry.variant}`:"";
      const side=entry.side?` · ${entry.side}`:"";
      const assist=entry.assisted?` · Assisted ${formatLoad(entry.assistanceWeight)} lb`:"";
      const load=entry.load!==null&&entry.load!==undefined?` · ${formatLoad(entry.load)} lb`:"";
      if(exercise.id==="treadmill"){
        return `${item.dataset.label} · ${duration(Number(entry.durationSeconds??entry.reps))} · ${fmt(Number(entry.incline||0),1)}% incline`;
      }
      const timed=exercise.id==="copenhagen-plank" || exercise.unit==="seconds";
      return `${item.dataset.label}${variant}${side}${assist}${load} · ${timed?duration(Number(entry.durationSeconds??entry.reps)):`${entry.reps} reps`}`;
      
    }
  };

  const chart=registerTrackingChart(new Chart(canvas.getContext("2d"),{
    type:"line",
    data:{datasets},
    options
  }));

  attachChartInteraction(chart,{kind:"strength",exercise});
  addChartToolbar(wrapper,chart);

  wrapper.dataset.chartEngine="chartjs";

  appendRepRangeLegend(wrapper,exercise,logs);

  return wrapper;
}

function buildTrackingSeries(exercise,plotted,dragonLevels){
  const seriesMap=new Map();
  const symbols=["circle","square","triangle","diamond","cross"];
  let symbolIndex=0;

  if(dragonLevels){
    dragonLevels.forEach((level,index)=>{
      const pts=plotted.filter(p=>p.levelId===level.id || p.variant===level.name);
      if(pts.length){
        seriesMap.set(level.id,{
          label:level.name,
          points:pts,
          symbol:dragonSymbol(index)
        });
      }
    });
    return seriesMap;
  }

  const hasVariants=plotted.some(p=>p.variant);
  const hasSides=plotted.some(p=>p.side);

  if(hasVariants || hasSides){
    plotted.forEach(point=>{
      const labelParts=[];
      if(point.variant) labelParts.push(point.variant);
      if(point.side) labelParts.push(point.side);
      if(point.assisted) labelParts.push("Assisted");
      const label=labelParts.length ? labelParts.join(" · ") : exercise.name;

      if(!seriesMap.has(label)){
        seriesMap.set(label,{
          label,
          points:[],
          symbol:symbols[symbolIndex++ % symbols.length]
        });
      }
      seriesMap.get(label).points.push(point);
    });
  }else{
    seriesMap.set("all",{
      label:exercise.name,
      points:plotted,
      symbol:"circle"
    });
  }

  return seriesMap;
}

function appendRepRangeLegend(wrapper,exercise,logs){
  if(exercise.levels){
    const legend=document.createElement("div");
    legend.className="rep-gradient-legend";
    legend.innerHTML='<span>Rep ranges vary by Dragon Flag level.</span>';
    wrapper.appendChild(legend);

    const levels=document.createElement("div");
    levels.className="symbol-legend";
    exercise.levels.forEach((level,index)=>{
      const range=repRangeForEntry({prescription:level.prescription},{});
      const text=range.min!==null
        ? `${level.name}: ${range.min}–${range.max}`
        : `${level.name}: ${level.prescription}`;
      levels.appendChild(makeSymbolLegendItem(dragonSymbol(index),text));
    });
    wrapper.appendChild(levels);
  }else{
    const range=repRangeForEntry(exercise,logs[0]||{});
    const gradientLegend=document.createElement("div");
    gradientLegend.className="rep-gradient-legend";

    if(range.min!==null && range.max!==null){
      gradientLegend.innerHTML=
        `<span>Rep range:</span>`+
        `<strong>${range.min}</strong>`+
        `<span class="rep-gradient-bar"></span>`+
        `<strong>${range.max}</strong>`;
    }else{
      gradientLegend.innerHTML='<span>Rep-range coloring unavailable for this exercise.</span>';
    }

    wrapper.appendChild(gradientLegend);
  }

  const arrowLegend=document.createElement("div");
  arrowLegend.className="rep-arrow-legend";
  arrowLegend.innerHTML=
    '<span><span class="rep-arrow-up">↑</span> Above rep-range maximum</span>'+
    '<span><span class="rep-arrow-down">↓</span> Below rep-range minimum</span>';
  wrapper.appendChild(arrowLegend);
}

function createRepAwareMarker(symbol,x,y,size,reps,min,max){
  if(min!==null && max!==null && reps>max){
    return createSvgMarker("upArrow",x,y,size+2,"#1565c0");
  }

  if(min!==null && max!==null && reps<min){
    return createSvgMarker("downArrow",x,y,size+2,"#111111");
  }

  const fill=repGradientColor(reps,min,max);
  return createSvgMarker(symbol,x,y,size,fill);
}

function renderStrengthLogList(exercise,logs){
  const section=document.createElement("section");
  section.className="progress-log-section";

  const heading=document.createElement("h3");
  heading.textContent="Logged sets";
  section.appendChild(heading);

  const list=document.createElement("ul");
  list.className="progress-list";
  const setNumberByDate=new Map();

  logs.forEach(entry=>{
    const currentNumber=(setNumberByDate.get(entry.date)||0)+1;
    setNumberByDate.set(entry.date,currentNumber);

    const item=document.createElement("li");
    item.className="tracking-log-row";

    const datePart=document.createElement("span");
    datePart.className="progress-date";
    datePart.textContent=entry.date;

    const details=document.createElement("span");
    const variant=entry.variant ? `${entry.variant} · ` : "";
    const side=entry.side ? `${entry.side} · ` : "";
    const assistance=entry.assisted
      ? (Number(entry.assistanceWeight)<0
          ? `Added ${formatLoad(Math.abs(Number(entry.assistanceWeight)))} lb · `
          : `Assistance ${formatLoad(entry.assistanceWeight)} lb · `)
      : "";
    const load=entry.load===null || entry.load===undefined ? "" : `${formatLoad(entry.load)} lb x `;

    if(exercise.id==="treadmill" || Number.isFinite(Number(entry.durationSeconds))){
      details.textContent=`Set ${currentNumber}: ${duration(Number(entry.durationSeconds??entry.reps))} · ${fmt(Number(entry.incline||0),1)}% incline`;
    }else{
      details.textContent=`Set ${currentNumber}: ${variant}${side}${assistance}${load}${entry.reps}`;
    }

    const storageId=entry._storageId || exercise.id;
    const remove=createTrackingDeleteButton(
      `Delete ${exercise.name} set from ${entry.date}`,
      ()=>{
        const confirmed=window.confirm(
          `Delete this ${exercise.name} log?\n\n`+
          `${entry.date} — ${exercise.id==="treadmill"
            ? `${duration(Number(entry.durationSeconds??entry.reps))} · ${fmt(Number(entry.incline||0),1)}% incline`
            : `${variant}${side}${assistance}${load}${entry.reps}`}\n\n`+
          `This action cannot be undone.`
        );
        if(!confirmed) return;

        workoutHistory.remove(storageId,entry);
        renderProgressHistory();
      }
    );

    item.append(datePart,details);
    if(!isPublicTrackingView()) item.appendChild(remove);
    list.appendChild(item);
  });

  section.appendChild(list);
  el.trackingResults.appendChild(section);
}

function buildDualAxisChart(config){
  const wrapper=document.createElement("div");
  wrapper.className="chart-card";

  const heading=document.createElement("div");
  heading.className="chart-title";
  heading.innerHTML=`<h3>${escapeHtml(config.title)}</h3><span class="chart-subtitle">${escapeHtml(config.subtitle)}</span>`;
  wrapper.appendChild(heading);

  const points=config.logs.map((entry,index)=>({
    entry,
    xTime:dateSortValue(entry.date)+(index*60000),
    left:Number(config.leftValue(entry)),
    right:Number(config.rightValue(entry))
  })).filter(point=>Number.isFinite(point.left)&&Number.isFinite(point.right));

  if(!ensureChartJsAvailable(wrapper)){
    return wrapper;
  }

  const canvas=createChartCanvas(wrapper,config.title);
  const theme=chartThemeColors();
  const options=commonChartOptions();

  options.scales={
    x:dateLinearScaleOptions(),
    yLeft:{
      type:"linear",
      position:"left",
      grace:"12%",
      ticks:{color:theme.muted,maxTicksLimit:6},
      grid:{color:theme.border,drawTicks:false},
      border:{display:false},
      title:{display:true,text:config.leftLabel,color:theme.muted,font:{size:11,weight:"600"}}
    },
    yRight:{
      type:"linear",
      position:"right",
      grace:"12%",
      ticks:{color:theme.muted,maxTicksLimit:6},
      grid:{drawOnChartArea:false,color:theme.border},
      border:{display:false},
      title:{display:true,text:config.rightLabel,color:theme.muted,font:{size:11,weight:"600"}}
    }
  };

  enableChartZoom(options,"cycling");

  options.plugins.tooltip.callbacks={
    title:items=>items.length?chartTooltipDate(items[0].raw.x):"",
    label:item=>{
      const raw=item.raw;
      return item.dataset.yAxisID==="yLeft"
        ? `${config.leftLabel}: ${config.leftFormat(raw.y)}`
        : `${config.rightLabel}: ${config.rightFormat(raw.y)}`;
    }
  };

  const datasets=[
    {
      label:config.leftLabel,
      yAxisID:"yLeft",
      data:points.map(point=>({x:point.xTime,y:point.left,_entry:point.entry})),
      parsing:false,
      borderColor:config.leftColor,
      backgroundColor:config.leftColor,
      pointBackgroundColor:config.leftColor,
      pointBorderColor:theme.card,
      pointBorderWidth:1.5,
      pointRadius:5,
      pointHoverRadius:7,
      pointStyle:"circle",
      tension:0,
      borderWidth:2.4
    },
    {
      label:config.rightLabel,
      yAxisID:"yRight",
      data:points.map(point=>({x:point.xTime,y:point.right,_entry:point.entry})),
      parsing:false,
      borderColor:config.rightColor,
      backgroundColor:config.rightColor,
      pointBackgroundColor:config.rightColor,
      pointBorderColor:theme.card,
      pointBorderWidth:1.5,
      pointRadius:5,
      pointHoverRadius:7,
      pointStyle:"rectRot",
      tension:0,
      borderWidth:2.4
    }
  ];

  const chart=registerTrackingChart(new Chart(canvas.getContext("2d"),{
    type:"line",
    data:{datasets},
    options
  }));

  attachChartInteraction(chart,{kind:"cycling"});
  addChartToolbar(wrapper,chart);

  return wrapper;
}

function paddedExtent(values){
  const valid=values.filter(Number.isFinite);
  const min=Math.min(...valid);
  const max=Math.max(...valid);
  const pad=Math.max((max-min)*0.12,Math.abs(max)*0.05,1);
  return {min:Math.max(0,min-pad),max:max+pad};
}

function drawChartGrid(svg,{margin,plotW,plotH,yMin,yMax,yLabel}){
  const ticks=5;
  for(let i=0;i<=ticks;i++){
    const y=margin.top+(plotH*i/ticks);
    svg.appendChild(svgElement("line",{x1:margin.left,y1:y,x2:margin.left+plotW,y2:y,class:"chart-grid"}));
    const value=yMax-((yMax-yMin)*i/ticks);
    const text=svgElement("text",{x:margin.left-10,y:y+4,"text-anchor":"end",class:"chart-tick"});
    text.textContent=formatAxisNumber(value);
    svg.appendChild(text);
  }

  svg.appendChild(svgElement("line",{x1:margin.left,y1:margin.top,x2:margin.left,y2:margin.top+plotH,class:"chart-axis"}));
  svg.appendChild(svgElement("line",{x1:margin.left,y1:margin.top+plotH,x2:margin.left+plotW,y2:margin.top+plotH,class:"chart-axis"}));

  const label=svgElement("text",{x:18,y:margin.top+plotH/2,transform:`rotate(-90 18 ${margin.top+plotH/2})`,"text-anchor":"middle",class:"chart-axis-label"});
  label.textContent=yLabel;
  svg.appendChild(label);
}

function drawDualAxisGrid(svg,{margin,plotW,plotH,leftExtent,rightExtent,leftLabel,rightLabel}){
  const ticks=5;
  for(let i=0;i<=ticks;i++){
    const y=margin.top+(plotH*i/ticks);
    svg.appendChild(svgElement("line",{x1:margin.left,y1:y,x2:margin.left+plotW,y2:y,class:"chart-grid"}));

    const leftValue=leftExtent.max-((leftExtent.max-leftExtent.min)*i/ticks);
    const leftText=svgElement("text",{x:margin.left-10,y:y+4,"text-anchor":"end",class:"chart-tick"});
    leftText.textContent=formatAxisNumber(leftValue);
    svg.appendChild(leftText);

    const rightValue=rightExtent.max-((rightExtent.max-rightExtent.min)*i/ticks);
    const rightText=svgElement("text",{x:margin.left+plotW+10,y:y+4,"text-anchor":"start",class:"chart-tick"});
    rightText.textContent=formatAxisNumber(rightValue);
    svg.appendChild(rightText);
  }

  svg.appendChild(svgElement("line",{x1:margin.left,y1:margin.top,x2:margin.left,y2:margin.top+plotH,class:"chart-axis"}));
  svg.appendChild(svgElement("line",{x1:margin.left+plotW,y1:margin.top,x2:margin.left+plotW,y2:margin.top+plotH,class:"chart-axis"}));
  svg.appendChild(svgElement("line",{x1:margin.left,y1:margin.top+plotH,x2:margin.left+plotW,y2:margin.top+plotH,class:"chart-axis"}));

  const left=svgElement("text",{x:18,y:margin.top+plotH/2,transform:`rotate(-90 18 ${margin.top+plotH/2})`,"text-anchor":"middle",class:"chart-axis-label"});
  left.textContent=leftLabel;
  svg.appendChild(left);

  const rightX=882;
  const right=svgElement("text",{x:rightX,y:margin.top+plotH/2,transform:`rotate(90 ${rightX} ${margin.top+plotH/2})`,"text-anchor":"middle",class:"chart-axis-label"});
  right.textContent=rightLabel;
  svg.appendChild(right);
}

function drawDateTicks(svg,dates,xScale,axisY,xMin,xMax){
  const unique=[...new Set(dates)];
  const maxTicks=6;
  const selected=unique.length<=maxTicks ? unique : unique.filter((_,i)=>i===0||i===unique.length-1||i%Math.ceil(unique.length/(maxTicks-1))===0);

  selected.forEach(date=>{
    const time=dateSortValue(date);
    const x=xScale(time);
    const tick=svgElement("line",{x1:x,y1:axisY,x2:x,y2:axisY+5,class:"chart-axis"});
    svg.appendChild(tick);

    const text=svgElement("text",{x,y:axisY+20,"text-anchor":"middle",class:"chart-tick"});
    const [m,d]=date.split("/");
    text.textContent=`${m}/${d}`;
    svg.appendChild(text);
  });

  const label=svgElement("text",{x:450,y:axisY+48,"text-anchor":"middle",class:"chart-axis-label"});
  label.textContent="Date";
  svg.appendChild(label);
}

function svgElement(name,attributes={}){
  const node=document.createElementNS("http://www.w3.org/2000/svg",name);
  Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
  return node;
}

function createSvgMarker(symbol,x,y,size,fill){
  if(symbol==="upArrow"){
    const group=svgElement("g",{fill,stroke:fill,"stroke-linejoin":"round"});
    group.appendChild(svgElement("polygon",{
      points:`${x},${y-size*1.5} ${x-size},${y-size*.25} ${x-size*.38},${y-size*.25} ${x-size*.38},${y+size} ${x+size*.38},${y+size} ${x+size*.38},${y-size*.25} ${x+size},${y-size*.25}`
    }));
    return group;
  }

  if(symbol==="downArrow"){
    const group=svgElement("g",{fill,stroke:fill,"stroke-linejoin":"round"});
    group.appendChild(svgElement("polygon",{
      points:`${x-size*.38},${y-size} ${x+size*.38},${y-size} ${x+size*.38},${y+size*.25} ${x+size},${y+size*.25} ${x},${y+size*1.5} ${x-size},${y+size*.25} ${x-size*.38},${y+size*.25}`
    }));
    return group;
  }

  if(symbol==="square"){
    return svgElement("rect",{x:x-size,y:y-size,width:size*2,height:size*2,rx:1,fill,stroke:"var(--card)","stroke-width":1.5});
  }

  if(symbol==="triangle"){
    const points=`${x},${y-size*1.2} ${x-size*1.1},${y+size} ${x+size*1.1},${y+size}`;
    return svgElement("polygon",{points,fill,stroke:"var(--card)","stroke-width":1.5});
  }

  if(symbol==="diamond"){
    const points=`${x},${y-size*1.2} ${x+size},${y} ${x},${y+size*1.2} ${x-size},${y}`;
    return svgElement("polygon",{points,fill,stroke:"var(--card)","stroke-width":1.5});
  }

  if(symbol==="cross"){
    const group=svgElement("g",{stroke:fill,"stroke-width":3,"stroke-linecap":"round"});
    group.appendChild(svgElement("line",{x1:x-size,y1:y,x2:x+size,y2:y}));
    group.appendChild(svgElement("line",{x1:x,y1:y-size,x2:x,y2:y+size}));
    return group;
  }

  return svgElement("circle",{cx:x,cy:y,r:size,fill,stroke:"var(--card)","stroke-width":1.5});
}

function makeSymbolLegendItem(symbol,label){
  const item=document.createElement("span");
  item.className="legend-item";

  const shape=document.createElement("span");
  shape.className="legend-symbol";
  if(symbol==="square") shape.classList.add("legend-square");
  else if(symbol==="triangle") shape.classList.add("legend-triangle");
  else if(symbol==="diamond") shape.classList.add("legend-diamond");
  else if(symbol==="cross") shape.classList.add("legend-cross");
  else shape.classList.add("legend-circle");

  const text=document.createElement("span");
  text.textContent=label;

  item.append(shape,text);
  return item;
}

function dragonSymbol(index){
  return ["circle","square","triangle","diamond","cross"][index%5];
}

function dragonLineColor(index){
  return ["#2563eb","#7c3aed","#d97706","#059669","#dc2626"][index%5];
}

function repRangeForEntry(exercise,entry){
  const source=entry.levelPrescription || exercise.prescription || "";
  const match=String(source).match(/(\d+)\s*[–-]\s*(\d+)/);
  if(match) return {min:Number(match[1]),max:Number(match[2])};

  const single=String(source).match(/(?:×|\s)(\d+)\s*(?:reps?)?/i);
  if(single) return {min:Number(single[1]),max:Number(single[1])};

  return {min:null,max:null};
}

function repGradientColor(reps,min,max){
  if(!Number.isFinite(Number(reps))||min===null||max===null) return "#6b7280";
  const value=Number(reps);

  if(max<=min) return value>=max ? "#228b22" : "#ff2400";

  const t=Math.max(0,Math.min(1,(value-min)/(max-min)));
  if(t<=0.5){
    return interpolateHex("#ff2400","#ffd700",t*2);
  }
  return interpolateHex("#ffd700","#228b22",(t-0.5)*2);
}

function interpolateHex(a,b,t){
  const parse=hex=>[
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16)
  ];
  const x=parse(a),y=parse(b);
  const c=x.map((v,i)=>Math.round(v+(y[i]-v)*t));
  return `#${c.map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}

function formatAxisNumber(value){
  if(Math.abs(value)>=100) return Math.round(value).toString();
  if(Math.abs(value)>=10) return value.toFixed(1).replace(/\.0$/,"");
  return value.toFixed(2).replace(/0+$/,"").replace(/\.$/,"");
}

function commuteTimeToMinutes(value){
  const match=String(value).match(/^(\d+):([0-5]\d)$/);
  return match ? Number(match[1])+Number(match[2])/60 : 0;
}

function minutesToDuration(value){
  const total=Math.round(value*60);
  return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;
}

function createTrackingDeleteButton(accessibilityLabel,onDelete){
  const button=document.createElement("button");
  button.type="button";
  button.className="tracking-delete-button";
  button.setAttribute("aria-label",accessibilityLabel);
  button.title="Delete log";
  button.innerHTML=
    '<svg viewBox="0 0 24 24" aria-hidden="true">'+
      '<path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM6 9h2v8H6V9zm1 11h10c1.1 0 2-.9 2-2V8H5v10c0 1.1.9 2 2 2z"/>'+
    '</svg>';
  button.addEventListener("click",onDelete);
  return button;
}

function saveWarmupState(splitId,dayId,index,checked){
  const date=normalizeWorkoutDate(el.strengthWorkoutDate.value);
  if(!date || !splitId) return;

  const key=`warmupState:${splitId}:${date}:${dayId}`;
  const state=getWarmupState(splitId,dayId,date);
  state[index]=checked;
  appStorage.setItem(key,JSON.stringify(state));
}

function getWarmupState(splitId,dayId,date){
  if(!date || !splitId) return {};

  try{
    const splitKey=`warmupState:${splitId}:${date}:${dayId}`;
    const splitData=appStorage.getItem(splitKey);

    if(splitData){
      const parsed=JSON.parse(splitData);
      return parsed&&typeof parsed==="object" ? parsed : {};
    }

    // Backward compatibility with warm-up checks saved before split profiles existed.
    const legacy=JSON.parse(appStorage.getItem(`warmupState:${date}:${dayId}`)||"{}");
    return legacy&&typeof legacy==="object" ? legacy : {};
  }catch{
    return {};
  }
}

function showWorkoutError(message){
  el.workoutLoggingMessage.textContent=message;
  el.workoutLoggingMessage.hidden=false;
}

function normalizeWorkoutDate(value){
  const raw=String(value||"").trim();

  let month,day,year;

  const native=raw.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  const legacy=raw.match(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/);

  if(native){
    year=Number(native[1]);
    month=Number(native[2]);
    day=Number(native[3]);
  }else if(legacy){
    month=Number(legacy[1]);
    day=Number(legacy[2]);
    year=Number(legacy[3]);
  }else{
    return null;
  }

  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day) return null;

  return `${String(month).padStart(2,"0")}/${String(day).padStart(2,"0")}/${year}`;
}

function formatDateForInput(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function dateSortValue(date){
  const [m,d,y]=date.split("/").map(Number);
  return new Date(y,m-1,d).getTime();
}

function makeLogId(){
  return (window.crypto&&crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatLoad(value){
  return Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value));
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}

function syncCommuteTimeFields(){
  const minutes=Math.max(0,Number(el.commuteMinutes?.value||0));
  const seconds=Math.max(0,Math.min(59,Number(el.commuteSeconds?.value||0)));
  if(el.commuteSeconds && el.commuteSeconds.value!=="" && Number(el.commuteSeconds.value)>59){
    el.commuteSeconds.value="59";
  }
  if(el.commuteTime){
    el.commuteTime.value=`${Math.floor(minutes)}:${String(Math.floor(seconds)).padStart(2,"0")}`;
  }
}

function update(){
  syncCommuteTimeFields();
  inputIds.forEach(id=>el[id].removeAttribute("aria-invalid"));
  try{
    const r=calculate();
    el.movingVelocity.textContent=fmt(r.movingVelocity,2);
    el.caloriesBurned.textContent=fmt(r.calories,1);
    el.mechanicalPower.textContent=fmt(r.power,1);
    el.pedalForce.textContent=fmt(r.force,1);
    el.overallVelocity.textContent=fmt(r.overallVelocity,2);
    el.cadence.textContent=fmt(r.cadence,1);
    el.movingTime.textContent=duration(r.movingTime);
    el.gradePercent.textContent=fmt(r.grade,2)+"%";
    el.rollingCoefficient.textContent=r.crr.toFixed(5);
    el.validationMessage.hidden=true;
  }catch(e){
    outputIds.forEach(id=>el[id].textContent="—");
    el.validationMessage.textContent=e.message||"Unable to calculate.";
    el.validationMessage.hidden=false;
    if(e.fieldId&&el[e.fieldId])el[e.fieldId].setAttribute("aria-invalid","true");
  }
}

function calculate(){
  const totalTime=parseTime(el.commuteTime.value);
  if(!el.commuteDate.value)throw err("Commute date is required.","commuteDate");

  const weight=pos(el.weightPounds.value,"Total weight","weightPounds");
  const distance=pos(el.distanceMiles.value,"Commute distance","distanceMiles");
  const elevation=nonneg(el.elevationFeet.value,"Total elevation gain","elevationFeet");
  const wheelDiameter=pos(el.wheelDiameterInches.value,"Wheel diameter","wheelDiameterInches");
  const pressure=pos(el.tirePressurePsig.value,"Tire pressure","tirePressurePsig");
  const dead=nonneg(el.deadTrafficSeconds.value,"Dead traffic time","deadTrafficSeconds");

  if(dead>=totalTime)throw err("Dead traffic time must be shorter than total commute time.","deadTrafficSeconds");

  const movingTime=totalTime-dead;
  const distanceM=distance*C.milesToMeters;
  const elevationM=elevation*C.feetToMeters;
  if(elevationM>=distanceM)throw err("Elevation gain must be less than route distance.","elevationFeet");

  const mass=weight*C.poundsToKg;
  const wheelRadius=wheelDiameter*C.inchesToMeters/2;
  const v=distanceM/movingTime;
  const movingVelocity=v*C.mpsToMph;
  const overallVelocity=(distanceM/totalTime)*C.mpsToMph;

  const sinSlope=elevationM/distanceM;
  const cosSlope=Math.sqrt(Math.max(0,1-sinSlope**2));
  const crr=clamp(C.referenceCrr*Math.sqrt(C.referencePressure/pressure),C.minCrr,C.maxCrr);

  const rolling=crr*mass*C.g*cosSlope;
  const aero=.5*C.airDensity*C.standingCdA*v**2;
  const climbing=mass*C.g*sinSlope;
  const wheelForce=rolling+aero+climbing;
  const wheelPower=wheelForce*v;
  const power=wheelPower/C.drivetrainEfficiency;

  const crankTorque=(wheelForce*wheelRadius*C.gearRatio)/C.drivetrainEfficiency;
  const force=(crankTorque/C.crankLengthMeters)*C.newtonsToLbf;
  const cadence=((v/(2*Math.PI*wheelRadius))/C.gearRatio)*60;

  const movingKcal=(power*movingTime/C.standingGrossEfficiency)/C.joulesPerKcal;
  const stoppedKcal=C.stoppedMET*3.5*mass/200*(dead/60);

  return{
    movingVelocity,overallVelocity,power,force,calories:movingKcal+stoppedKcal,
    cadence,movingTime,grade:sinSlope*100,crr
  };
}

function parseTime(value){
  const m=String(value).trim().match(/^(\d+):([0-5]\d)$/);
  if(!m)throw err("Commute time must use mm:ss, such as 29:00.","commuteTime");
  const s=Number(m[1])*60+Number(m[2]);
  if(s<=0)throw err("Commute time must be greater than zero.","commuteTime");
  return s;
}
function pos(value,label,field){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)throw err(label+" must be greater than zero.",field);
  return n;
}
function nonneg(value,label,field){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw err(label+" cannot be negative.",field);
  return n;
}
function err(message,fieldId){const e=new Error(message);e.fieldId=fieldId;return e}
function clamp(v,min,max){return Math.min(Math.max(v,min),max)}
function fmt(v,d){return new Intl.NumberFormat(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}).format(v)}
function duration(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}

// Initialize the fitness UI only after Firebase Authentication has selected a user.
let fitnessAppInitialized=false;

window.initializeFitnessApp=function(){
  if(fitnessAppInitialized) return;
  fitnessAppInitialized=true;

  el.clearAllDataButton?.addEventListener("click",async()=>{
    const ok=confirm(
      "This will permanently delete all workout logs, cycling logs, custom splits, custom exercises, and saved settings for the currently signed-in account from both this device and Firestore.\n\n"+
      "The Firebase account itself will remain active.\n\nThis cannot be undone. Continue?"
    );
    if(!ok) return;

    try{
      if(typeof window.clearCurrentUserFitnessData==="function"){
        await window.clearCurrentUserFitnessData();
      }else{
        appStorage.clear();
      }
      alert("This account's workout data has been deleted. The app will now reload.");
      location.reload();
    }catch(error){
      console.error(error);
      alert("The data could not be completely deleted. Check your connection and try again.");
    }
  });

  setupAppearance();
  setupLogDetailSheet();
  setupTabs();
  setupSplitManager();
  migrateLegacyWorkoutLogAliases();
  setupWorkoutLogging();
  setupWorkoutTracking();
  setupCyclingLogging();
  setupSettingsPersistence();
  setupExerciseLibrarySettings();
  setupDataBackups();
  setupGymManager();
  migrateKnownSideExerciseLogs();
  update();
};
