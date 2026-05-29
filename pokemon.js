
// Variables to store Pokemon data during the battle
let playerPokemon = null;
let enemyPokemon = null;
let playerMoves = []; // List of player's moves
let enemyMoves = []; // List of enemy's moves
let playerTurn = true; // true = player's turn, false = enemy's turn
let battleOver = false; // true = battle is finished

// Type advantage table - determines damage multiplier
const typeChart = {
    fire:{superEffective:["grass", "bug"], notVerryEffective:["water", "rock"], noEffect: []},
    water:{superEffective:["fire", "rock"], notVerryEffective:["grass"], noEffect: []},
    grass:{superEffective:["water", "rock"], notVerryEffective:["fire", "bug"], noEffect: []},
    normal:{superEffective:[], notVerryEffective:[], noEffect: []}
}

// Get type multiplier based on attack type vs defender type
function getTypeMultiplier(attackType, defenderType){
    const chart = typeChart[attackType];
    if(!chart) return 1; // Unknown type = normal damage

    if(chart.superEffective.includes(defenderType)) return 2; // Double damage
    if(chart.notVerryEffective.includes(defenderType)) return 0.5; // Half damage
    if(chart.noEffect.includes(defenderType)) return 0; // No damage
    return 1; // Normal damage
}

// Fetch move data from PokeAPI (power, accuracy, type)
async function fetchMoveData(moveUrl) {
    const response = await fetch(moveUrl);
    const data = await response.json();
    return{
        name: data.name,
        power: data.power || 40,       // If no power, use 40 as default
        accuracy: data.accuracy || 100, // If no accuracy, use 100
         type: data.type.name           // Move type (fire, water, etc.)
    };
}

// Fetch Pokemon data from PokeAPI
async function fetchPokemon(name) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await response.json();

    // Get base stats from the stats array
    const stats = {};
    data.stats.forEach(s => {
        stats[s.stat.name] = s.base_stat;
    });

    // Get first 4 moves and fetch their data
    const moveList = data.moves.slice(0, 4);
    const moves = await Promise.all(
        moveList.map(m => fetchMoveData(m.move.url))
    );

    return {
        name: data.name,
        type: data.types[0].type.name, // Primary type
        hp: stats["hp"],
        maxHp: stats["hp"],            // Remember max HP for HP bar calculation
        attack: stats["attack"],
        defense: stats["defense"],
        specialAttack: stats["special-attack"],
        specialDefense: stats["special-defense"],
        speed: stats["speed"],
        moves: moves,
        sprite: data.sprites.front_default,      // Front image
        backSprite: data.sprites.back_default     // Back image (for player)
    };
}

// Calculate damage using the official Pokemon formula
function CalculateDamage(attacker, defender, move){
    const level = 5; // Both Pokemon are level 5
    const power = move.power;

    // Use special attack/defense for special moves, otherwise physical
    const attack = attacker.attack;
    const defense = defender.defense;

    // Official Pokemon damage formula
    let damage =  ((2 * level / 5 + 2) * power * (attack / defense)) / 50 + 2;
    
    // STAB bonus - same type attack bonus
    const stab = attacker.type === move.type ? 1.5 : 1;

    // Type advantage multiplier
    const typeMultiplier = getTypeMultiplier(move.type, defender.type);

    // Random factor between 0.85 and 1.0
    const random = Math.random() * (1 - 0.85) + 0.85;

    // Apply all modifiers
    damage = Math.floor(damage * stab * typeMultiplier * random)

    return Math.max(1, damage); // Minimum 1 damage
}

// Update HP bar and HP text on screen
function UpdateHpBar(who){
    if(who === "player"){
        const percent = (playerPokemon.hp / playerPokemon.maxHp) * 100
        document.getElementById("player-hp-bar").style.width = percent + "%";
        document.getElementById("player-hp-text").textContent = `HP: ${playerPokemon.hp}/${playerPokemon.maxHp}`;
        // Change color based on HP
        const bar = document.getElementById("player-hp-bar");
        if(percent < 25) bar.style.backgroundColor = "red";
        else if (percent < 50) bar.style.backgroundColor = "orange";
        else bar.style.backgroundColor = "#00cc00";
    }
    else{
        const percent = (enemyPokemon.hp / enemyPokemon.maxHp) * 100;
        document.getElementById("enemy-hp-bar").style.width = percent + "%";
        document.getElementById("enemy-hp-text").textContent = `HP: ${enemyPokemon.hp}/${enemyPokemon.maxHp}`;

        const bar = document.getElementById("enemy-hp-bar");
        if (percent < 25) bar.style.backgroundColor = "red";
        else if (percent < 50) bar.style.backgroundColor = "orange";
        else bar.style.backgroundColor = "#00cc00";
    }
}

// Show a message in the battle log
function log(message){
    document.getElementById("log-text").textContent = message;
}

// Disable or enable move buttons
function setButtonsDisabled(disabled){
    document.querySelectorAll(".move-btn").forEach(btn =>{btn.disabled = disabled;})
}

// Enemy attacks automatically with a random move
function enemyAttack(){
    if (battleOver) return;

    const move = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
    const damage = CalculateDamage(enemyPokemon, playerPokemon, move);

    playerPokemon.hp = Math.max(0, playerPokemon.hp - damage);
    UpdateHpBar("player");
    log(`${enemyPokemon.name.toUpperCase()} used ${move.name}! It dealt ${damage} damage!`);

    // Shake player when hit
    const playerImg = document.getElementById("player-img");
    playerImg.classList.add("shake");
    setTimeout(() => playerImg.classList.remove("shake"), 400);

    // Check if player lost
    if (playerPokemon.hp <= 0){
        setTimeout(() => {
            log(`${playerPokemon.name.toUpperCase()} fainted! ${enemyPokemon.name.toUpperCase()} wins!`);
            battleOver = true;
            setButtonsDisabled(true);
            document.getElementById("play-again-btn").style.display = "block";

        }, 1000);
        return;
    }

    // Give turn back to player
    setTimeout(() => {
        playerTurn = true;
        setButtonsDisabled(false);
        log(`What will ${playerPokemon.name.toUpperCase()} do?`);
    }, 1500);
}

// Player attacks with selected move
function playerAttack(moveIndex){
    if(!playerTurn || battleOver ) return;

    const move = playerMoves[moveIndex];
    const damage = CalculateDamage(playerPokemon, enemyPokemon, move);

    enemyPokemon.hp =   Math.max(0, enemyPokemon.hp - damage);
    UpdateHpBar("enemy");
    log(`${playerPokemon.name.toUpperCase()} used ${move.name}! It dealt ${damage} damage!`);

    // Shake enemy when hit
    const enemyImg = document.getElementById("enemy-img");
    enemyImg.classList.add("shake");
    setTimeout(() => enemyImg.classList.remove("shake"), 400);

    // Disable buttons during enemy turn
    playerTurn = false;
    setButtonsDisabled(true);

    // Check if enemy lost
    if (enemyPokemon.hp <= 0) {
        setTimeout(() => {
            log(`${enemyPokemon.name.toUpperCase()} fainted! ${playerPokemon.name.toUpperCase()} wins!`);
            battleOver = true;
            document.getElementById("play-again-btn").style.display = "block";
        }, 1000);
        return;
    }

     // Enemy attacks after 1.5 seconds
     setTimeout(enemyAttack, 1500);
}

// Display Pokemon data on screen
function displayPokemon(){
    //Enemy
    document.getElementById("enemy-name").textContent = enemyPokemon.name.toUpperCase() + " Lv5";
    document.getElementById("enemy-type").textContent = `Type: ${enemyPokemon.type}`;
    document.getElementById("enemy-hp-text").textContent = `HP: ${enemyPokemon.hp}/${enemyPokemon.maxHp}`;
    document.getElementById("enemy-img").src = enemyPokemon.sprite;
    document.getElementById("enemy-stats").textContent = `ATK: ${enemyPokemon.attack} | DEF: ${enemyPokemon.defense} | SPD: ${enemyPokemon.speed}`;


     // Player
    document.getElementById("player-name").textContent = playerPokemon.name.toUpperCase() + " Lv5";
    document.getElementById("player-type").textContent = `Type: ${playerPokemon.type}`;
    document.getElementById("player-hp-text").textContent = `HP: ${playerPokemon.hp}/${playerPokemon.maxHp}`;
    document.getElementById("player-img").src = playerPokemon.backSprite;
    document.getElementById("player-stats").textContent = `ATK: ${playerPokemon.attack} | DEF: ${playerPokemon.defense} | SPD: ${playerPokemon.speed}`;

    // Move buttons
    playerMoves = playerPokemon.moves;
    enemyMoves = enemyPokemon.moves;

    const buttons = document.querySelectorAll(".move-btn");
    playerMoves.forEach((move, i) => {buttons[i].textContent = move.name.toUpperCase();});

    
    // Show who goes first based on speed
    if (playerPokemon.speed >= enemyPokemon.speed){
        playerTurn = true;
         setButtonsDisabled(false);
        log(`What will ${playerPokemon.name.toUpperCase()} do?`);
    }
    else{
         playerTurn = false;
        setButtonsDisabled(true);
        log(`${enemyPokemon.name.toUpperCase()} goes first!`);
        setTimeout(enemyAttack, 1500);
    }

}

// Start the game - fetch both Pokemon and begin battle
async function startGame() {
    // Get Pokemon names from input fields
    const playerName = document.getElementById("player-input").value.toLowerCase().trim();
    const enemyName = document.getElementById("enemy-input").value.toLowerCase().trim();

    // Show loading message
    document.getElementById("error-msg").textContent ="";
    document.getElementById("start-btn").disabled = true;
    document.getElementById("start-btn").textContent = "loading...";

    try{
        // Fetch both Pokemon at the same time
        [playerPokemon, enemyPokemon] = await Promise.all([fetchPokemon(playerName), fetchPokemon(enemyName)]);

        // Hide selection screen and show battle screen
        document.getElementById("selection-screen").style.display ="none";
        document.getElementById("battle-screen").style.display ="block";

         // Reset battle variables
         battleOver = false;
         playerTurn =true;

         displayPokemon();

         // Add click events to move buttons
        document.getElementById("move1").addEventListener("click", () => playerAttack(0));
        document.getElementById("move2").addEventListener("click", () => playerAttack(1));
        document.getElementById("move3").addEventListener("click", () => playerAttack(2));
        document.getElementById("move4").addEventListener("click", () => playerAttack(3));
    }catch(error){
            console.log(error);
        document.getElementById("error-msg").textContent ="Pokemon not found! Try another name.";
        document.getElementById("start-btn").disabled = false;
        document.getElementById("start-btn").textContent =" START BATTLE";
    }
       
}

// Start button click event
document.getElementById("start-btn").addEventListener("click", startGame);

// Hide battle screen at start
document.getElementById("battle-screen").style.display = "none";

//play again button
       document.getElementById("play-again-btn").addEventListener("click", () => {
        document.getElementById("battle-screen").style.display="none";
        document.getElementById("selection-screen").style.display="block";
        document.getElementById("play-again-btn").style.display="none";
        document.getElementById("start-btn").disabled = false;
        document.getElementById("start-btn").textContent ="START BATTLE"
        document.getElementById("run-btn").disabled = false; 
       })


//run button - player tries to escape
document.getElementById("run-btn").addEventListener("click", () =>{

    if (battleOver) return; 

    //50% chance to escape
    const escaped = Math.random() < 0.5;

    if(escaped){
        log("You escaped!!!!(such a loser :dddd)")
        battleOver = true;
        setButtonsDisabled(true);
        document.getElementById("run-btn").disabled = true;
        setTimeout(() => {
        document.getElementById("battle-screen").style.display = "none";
        document.getElementById("selection-screen").style.display = "block";
        document.getElementById("play-again-btn").style.display = "none",
        document.getElementById("start-btn").disabled = false;
        document.getElementById("start-btn").textContent = "START BATTLE";
        document.getElementById("run-btn").disabled = false; 
        }, 3000)
    }

    else{
     // Failed to escape - enemy attacks
     log("Can't escape")
     playerTurn = false;
     setButtonsDisabled(true);
     document.getElementById("run-btn").disabled = true;
    setTimeout(() => {
    enemyAttack();
    document.getElementById("run-btn").disabled = false;
    }, 1500);
    }
})