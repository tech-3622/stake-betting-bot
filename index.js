(async () => {
    let initialBet = 0.02;
    let currentBet = initialBet;
    let target = 66;
    let condition = "below";
    let identifier = generateIdentifier();
    let maxPlays = 200000;
    let plays = 0;
    let galeLevel = 1;
    const accessToken = "099bdbe447a422c4ce9c53f0d7004f22d632a698c39516c86d4fb3b90108e32115a1e9600644ed3797884ec4f9d05b34";
    let controller = new AbortController();
    let lastGameWon = true; // Track if last game was a win

    function generateIdentifier() {
        return Math.random().toString(36).substring(2, 15);
    }

    async function placeBet() {
        if (plays >= maxPlays) {
            console.log("Max plays reached. Stopping.");
            return;
        }

        plays++;
        console.log(`Play ${plays}: Betting ${currentBet.toFixed(2)} (Gale Level: ${galeLevel})`);

        try {
            controller = new AbortController();
            const response = await fetch("https://stake.com/_api/graphql", {
                method: "POST",
                headers: {
                    "accept": "*/*",
                    "content-type": "application/json",
                    "x-access-token": accessToken,
                    "Referer": "https://stake.com/casino/games/dice"
                },
                body: JSON.stringify({
                    query: `mutation DiceRoll($amount: Float!, $target: Float!, $condition: CasinoGameDiceConditionEnum!, $currency: CurrencyEnum!, $identifier: String!) {
                        diceRoll(amount: $amount, target: $target, condition: $condition, currency: $currency, identifier: $identifier) {
                            ...CasinoBet
                            state {
                                ...CasinoGameDice
                            }
                        }
                    }
                    fragment CasinoBet on CasinoBet {
                        id
                        active
                        payoutMultiplier
                        amountMultiplier
                        amount
                        payout
                        updatedAt
                        currency
                        game
                        user {
                            id
                            name
                        }
                    }
                    fragment CasinoGameDice on CasinoGameDice {
                        result
                        target
                        condition
                    }`,
                    variables: {
                        target: target,
                        condition: condition,
                        identifier: identifier,
                        amount: currentBet,
                        currency: "ngn"
                    }
                }),
                signal: controller.signal
            });

            const data = await response.json();

            if (data.data && data.data.diceRoll) {
                const result = data.data.diceRoll.state.result;
                const won = (condition === "below" && result < target) || (condition === "above" && result > target);

                console.log(`Result: ${result}, Won: ${won}`);

                if (won) {
                    console.log("Won! Resetting bet to initial bet.");
                    currentBet = initialBet;
                    galeLevel = 1;
                    lastGameWon = true;
                    await placeBet(); // Keep playing without restarting
                } else {
                    console.log("Lost! Restarting script with new seed...");
                    lastGameWon = false;
                    stopAndRestart(true);
                }
            } else {
                console.error("Error placing bet:", data);
                console.log("Restarting script...");
                stopAndRestart(false);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            console.log("Restarting script...");
            stopAndRestart(false);
        }
    }

    async function changeSeed() {
        const newSeed = Math.random().toString(36).substring(2, 15);

        try {
            controller = new AbortController();
            const response = await fetch("https://stake.com/_api/graphql", {
                method: "POST",
                headers: {
                    "accept": "application/graphql+json, application/json",
                    "content-type": "application/json",
                    "x-access-token": accessToken,
                    "Referer": "https://stake.com/casino/games/dice"
                },
                body: JSON.stringify({
                    query: `mutation RotateSeedPair($seed: String!) {
                        rotateSeedPair(seed: $seed) {
                            clientSeed {
                                user {
                                    id
                                    activeClientSeed {
                                        id
                                        seed
                                    }
                                    activeServerSeed {
                                        id
                                        nonce
                                        seedHash
                                        nextSeedHash
                                    }
                                }
                            }
                        }
                    }`,
                    variables: { seed: newSeed }
                }),
                signal: controller.signal
            });

            const data = await response.json();
            if (data.data && data.data.rotateSeedPair) {
                console.log(`Seed changed: ${newSeed}`);
                return true;
            } else {
                console.error("Error changing seed:", data);
                return false;
            }
        } catch (error) {
            console.error("Error changing seed:", error);
            return false;
        }
    }

    async function stopAndRestart(fromLoss = false) {
        console.log("Stopping script...");
        controller.abort();
        console.log("Clearing all pending requests...");

        setTimeout(async () => {
            console.log("Restarting script...");

            identifier = generateIdentifier();
            if (!fromLoss) {
                console.log("Restarting due to error, continuing with same hash.");
            } else {
                console.log("Restarting due to loss, changing seed 3 times before playing...");
                let seedChanges = 0;
                for (let i = 0; i < 3; i++) {
                    let success = await changeSeed();
                    if (success) {
                        seedChanges++;
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between each change
                    }
                }

                if (seedChanges < 3) {
                    console.log("Error while changing seed. Restarting process...");
                    stopAndRestart(true); // Restart seed change process
                    return;
                }
            }

            if (!fromLoss) {
                if (lastGameWon) {
                    console.log("Last game was a win, continuing play...");
                    await placeBet();
                } else {
                    console.log("Error occurred after a loss, restarting at same gale level and ensuring seed change...");
                    await stopAndRestart(true);
                }
            } else {
                console.log(`Restarting after loss, moving to gale level ${galeLevel + 1}`);
                galeLevel++;
                currentBet *= 3;
                await placeBet();
            }
        }, 5000);
    }

    console.log("Starting script...");
    placeBet();
})();
