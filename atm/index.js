import express from 'express';

const server = express();
server.use(express.json());

const defaultBanknotes = [1, 5, 10, 20, 100, 500, 1000];
let atmInitialised = false;

let atm = new Map();
atm.set('balance', 0);
atm.set('banknotes', new Map(defaultBanknotes.map(banknoteValue => [banknoteValue, 0]))); 

// Function to sort banknotes from the biggest value to the smallest one
const getSortedBanknotes = () => {
    const banknotes = atm.get('banknotes');
    return [...banknotes.entries()]
        .filter(([value, count]) => count >= 0) 
        .sort(([a], [b]) => b - a); 
};

// Function for distributing banknotes efficiently
const distributeBanknotes = (amount, banknotes, isDeposit = false) => {
    const sortedBanknotes = getSortedBanknotes();

    const transaction = new Map();
    for (let [banknoteValue, count] of sortedBanknotes) {
        const needed = Math.floor(amount / banknoteValue); // How many of this banknote are needed
        const available = isDeposit ? Infinity : count; // Deposits allow an infinite supply of banknotes, otherwise uses the count 
        const used = Math.min(needed, available); // Use only as many as are available
        if (used > 0) {
            transaction.set(banknoteValue, used);
            amount -= used * banknoteValue;
            if (!isDeposit) {
                banknotes.set(banknoteValue, count - used); // Deduct used banknotes for withdrawals
            }
        }
    }

    return { transaction, remainingAmount: amount };
};

// TODO: 2. Implement ATM initialization => `/`
server.post('/', async (req, res) => {
    const { banknotes } = req.body;
    atmInitialised = true;

    if (banknotes.length === 0) {
        banknotes.push(...defaultBanknotes);
    }

    const isValid = banknotes.every(selection => defaultBanknotes.includes(selection));
    if (!isValid) {
        return res.status(400).json({ message: 'Invalid list of banknotes!' });
    }

    const initializedBanknotes = new Map(banknotes.map(banknoteValue => [banknoteValue, 0]));
    atm.set('banknotes', initializedBanknotes);

    

    res.status(200).json({ message: 'ATM is up and running' });
});

// TODO: 3. Implement ATM deposit => `/deposit`
server.post('/deposit', async (req, res) => {
    const {amount} = req.body
    if (!atmInitialised) {
        return res.status(400).json({ error: "Cannot make transaction. ATM is not initialized!" });
    }

    const banknotes = atm.get('banknotes');
    const { transaction } = distributeBanknotes(amount, banknotes, true);

    // Function to check if amount can be depositted with allowed banknotes
    const canDeposit = (amount, banknotes) => {
        for (let [banknoteValue, count] of banknotes) {
            const needed = Math.floor(amount / banknoteValue);
            amount -= Math.min(needed, count) * banknoteValue;
        }
        return amount === 0;
    };
   // Error if can't deposit money
    if(!canDeposit){
        return res.status(400).json({error:" Cannot make transaction. Banknotes for this transaction are not accepted"})
    }

    // Update ATM state
    for (let [banknoteValue, count] of transaction) {
        banknotes.set(banknoteValue, banknotes.get(banknoteValue) + count);
    }
    atm.set('balance', atm.get('balance') + amount);

    res.status(200).json({
        message: `Successful deposit of ${amount} TDL dollars!`,
        transaction: Object.fromEntries(transaction),
    });
});


// TODO: 4. Implement ATM withdraw => `/withdraw`
server.post('/withdraw', async (req, res) => {
    const { amount } = req.body;

    if (!atmInitialised) {
        return res.status(400).json({ error: "Cannot make transaction. ATM is not initialized!" });
    }

    const currentBalance = atm.get('balance');
    if (amount > currentBalance) {
        return res.status(400).json({ error: "Not enough money in the ATM!" });
    }

    // Function to check if amount is withdrawable with available banknotes
    const canWithdraw = (amount) => {
        const sortedBanknotes = getSortedBanknotes();
        for (let [banknoteValue, count] of sortedBanknotes) {
            const needed = Math.floor(amount / banknoteValue);
            const used = Math.min(needed, count);
            amount -= used * banknoteValue;
        }
        return amount === 0;
    };

    // Error if can't withdraw with remaining banknotes
    if (!canWithdraw(amount)) {
        return res.status(400).json({ error: "Requested amount cannot be withdrawn with available banknotes!" });
    }

    // Withdraw logic
    const withdraw = (amount) => {
        const sortedBanknotes = getSortedBanknotes();
        const transaction = {};

        for (let [banknoteValue, count] of sortedBanknotes) {
            const needed = Math.floor(amount / banknoteValue);
            const used = Math.min(needed, count);
            if (used > 0) {
                transaction[banknoteValue] = used;
                amount -= used * banknoteValue;
                atm.get('banknotes').set(banknoteValue, count - used); // Update ATM banknotes
            }
        }

        atm.set('balance', atm.get('balance') - amount); // Update ATM balance
        return transaction;
    };

    const transaction = withdraw(amount);

    res.status(200).json({
        message: `Successful withdrawal of ${amount} TDL dollars!`,
        transaction: { ...transaction, total: amount },
    });
});

// TODO: BONUS - Implement ATM balance check => `/balance`
server.get('/balance', async (req, res) => {
    if (!atmInitialised) {
        return res.status(400).json({ error: "Cannot check balance. ATM is not initialized!" });
    }
    
    const balance = atm.get('balance');
    res.status(200).json({ balance });
    
});

server.listen(3001, () => {
    console.log("Server is up and running!");
});
